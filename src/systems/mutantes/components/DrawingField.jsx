import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const maxImageSize = 10 * 1024 * 1024;
const maxPixels = 30_000_000;

function readDrawing(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed?.version !== 1 || typeof parsed.updatedAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function openLogin() {
  const login = new URL("/outpost.goauthentik.io/start", window.location.origin);
  login.searchParams.set("rd", window.location.href);
  window.location.assign(login.href);
}

async function readSource(url) {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", redirect: "manual" });
  if (response.status === 401 || response.type === "opaqueredirect") {
    throw new Error("Sua sessão expirou. Atualize a ficha e entre novamente para editar a imagem.");
  }
  if (!response.ok) throw new Error(response.status === 404
    ? "A imagem não foi encontrada nesta ficha."
    : "Não foi possível abrir a imagem desta ficha.");
  return response.blob();
}

function loadImage(blobUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível ler esta imagem."));
    image.src = blobUrl;
  });
}

function restoreCropPercentages(crop, imageWidth, imageHeight, rotation) {
  if (!crop || !Number.isFinite(Number(crop.x)) || !Number.isFinite(Number(crop.y))
    || !Number.isFinite(Number(crop.width)) || !Number.isFinite(Number(crop.height))) return null;
  const stored = {
    x: Number(crop.x),
    y: Number(crop.y),
    width: Number(crop.width),
    height: Number(crop.height),
  };
  if (stored.width <= 0 || stored.height <= 0) return null;
  if (Math.max(Math.abs(stored.x), Math.abs(stored.y), stored.width, stored.height) <= 100) return stored;

  // Older saves stored croppedAreaPixels where the editor now expects percentages.
  const radians = rotation * Math.PI / 180;
  const rotatedWidth = Math.abs(Math.cos(radians) * imageWidth) + Math.abs(Math.sin(radians) * imageHeight);
  const rotatedHeight = Math.abs(Math.sin(radians) * imageWidth) + Math.abs(Math.cos(radians) * imageHeight);
  if (!rotatedWidth || !rotatedHeight) return null;
  return {
    x: stored.x / rotatedWidth * 100,
    y: stored.y / rotatedHeight * 100,
    width: stored.width / rotatedWidth * 100,
    height: stored.height / rotatedHeight * 100,
  };
}

function blobFromCanvas(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Não foi possível preparar a imagem.")), "image/webp", 0.92);
  });
}

async function makePreview(blobUrl, fit, cropArea, rotation) {
  const image = await loadImage(blobUrl);
  const radians = rotation * Math.PI / 180;
  const rotatedWidth = Math.ceil(Math.abs(Math.cos(radians) * image.width) + Math.abs(Math.sin(radians) * image.height));
  const rotatedHeight = Math.ceil(Math.abs(Math.sin(radians) * image.width) + Math.abs(Math.cos(radians) * image.height));
  const rotated = document.createElement("canvas");
  rotated.width = rotatedWidth;
  rotated.height = rotatedHeight;
  const context = rotated.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem.");
  context.translate(rotatedWidth / 2, rotatedHeight / 2);
  context.rotate(radians);
  context.drawImage(image, -image.width / 2, -image.height / 2);

  const area = fit === "cover" && cropArea
    ? cropArea
    : { x: 0, y: 0, width: rotatedWidth, height: rotatedHeight };
  const scale = Math.min(1, 2400 / Math.max(area.width, area.height));
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(area.width * scale));
  output.height = Math.max(1, Math.round(area.height * scale));
  const outputContext = output.getContext("2d");
  if (!outputContext) throw new Error("Não foi possível preparar a imagem.");
  outputContext.drawImage(rotated, area.x, area.y, area.width, area.height,
    0, 0, output.width, output.height);
  return blobFromCanvas(output);
}

export function DrawingField({ sheetId, user, saving, saveSheet, value, onChange }) {
  const inputRef = useRef(null);
  const stageRef = useRef(null);
  const dialogRef = useRef(null);
  const localUrlRef = useRef("");
  const [editing, setEditing] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceFile, setSourceFile] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [cropPixels, setCropPixels] = useState(null);
  const [cropPercent, setCropPercent] = useState(null);
  const [aspect, setAspect] = useState(1.25);
  const [fit, setFit] = useState("cover");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const drawing = useMemo(() => readDrawing(value), [value]);
  const baseUrl = sheetId ? `/api/sheets/${encodeURIComponent(sheetId)}/drawing` : "";
  const imageUrl = drawing && baseUrl
    ? `${baseUrl}?v=${encodeURIComponent(drawing.updatedAt)}`
    : "";

  useEffect(() => {
    if (!stageRef.current || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0]?.contentRect || {};
      if (width > 0 && height > 0) setAspect(width / height);
    });
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [editing]);

  useEffect(() => () => {
    if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
  }, []);

  useLayoutEffect(() => {
    if (editing) {
      if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
      const rect = stageRef.current?.getBoundingClientRect();
      if (rect?.width > 0 && rect?.height > 0) setAspect(rect.width / rect.height);
      setEditorVisible(true);
    } else if (dialogRef.current?.open) dialogRef.current.close();
    if (!editing) setEditorVisible(false);
  }, [editing]);

  const resetSource = () => {
    if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
    localUrlRef.current = "";
    setSourceFile(null);
    setSourceUrl("");
  };

  const beginFile = async file => {
    setError("");
    if (!file) return;
    if (!allowedTypes.has(file.type)) {
      setError("Escolha uma imagem JPEG, PNG, WebP, GIF ou AVIF.");
      return;
    }
    if (file.size > maxImageSize) {
      setError("A imagem deve ter no máximo 10 MB.");
      return;
    }
    if (drawing && !window.confirm("Substituir o desenho desta ficha?")) return;
    resetSource();
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      if (image.width * image.height > maxPixels) {
        URL.revokeObjectURL(url);
        setError("A imagem é muito grande. Reduza suas dimensões antes de enviar.");
        return;
      }
    } catch (imageError) {
      URL.revokeObjectURL(url);
      setError(imageError.message);
      return;
    }
    localUrlRef.current = url;
    setSourceFile(file);
    setSourceUrl(url);
    setFit("cover");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCropPixels(null);
    setCropPercent(null);
    setEditing(true);
  };

  const editExisting = async () => {
    if (!imageUrl || busy) return;
    setBusy(true);
    setError("");
    try {
      const blob = await readSource(`${baseUrl}/source?v=${encodeURIComponent(drawing.updatedAt)}`);
      resetSource();
      const url = URL.createObjectURL(blob);
      const image = await loadImage(url);
      if (image.width * image.height > maxPixels) {
        URL.revokeObjectURL(url);
        throw new Error("A imagem é muito grande para editar no navegador.");
      }
      localUrlRef.current = url;
      setSourceUrl(url);
      setFit(drawing.fit || "cover");
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      const existingRotation = Number(drawing.rotation) || 0;
      setRotation(existingRotation);
      setCropPixels(null);
      setCropPercent(restoreCropPercentages(drawing.crop, image.naturalWidth, image.naturalHeight, existingRotation));
      setEditing(true);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setBusy(false);
    }
  };

  const closeEditor = () => {
    if (busy) return;
    setEditing(false);
    resetSource();
  };

  const upload = async () => {
    if (!user?.uid || !sourceUrl || busy) return;
    setBusy(true);
    setError("");
    try {
      let targetSheetId = sheetId;
      if (!targetSheetId) {
        if (saving) throw new Error("Aguarde o salvamento da ficha e tente novamente.");
        const savedSheet = await saveSheet();
        targetSheetId = savedSheet?.id;
        if (!targetSheetId) throw new Error("Não foi possível salvar a ficha para receber o desenho.");
      }

      const headers = {
        "X-Ficha-Request": "1",
        "X-Ficha-Account": user.uid,
      };
      if (sourceFile) {
        headers["Content-Type"] = sourceFile.type;
        const originalResponse = await fetch(`/api/sheets/${encodeURIComponent(targetSheetId)}/drawing/source`, {
          method: "PUT", credentials: "same-origin", cache: "no-store", redirect: "manual",
          headers, body: sourceFile,
        });
        if (originalResponse.status === 401 || originalResponse.type === "opaqueredirect") {
          openLogin();
          throw new Error("Sua sessão expirou. Entre novamente.");
        }
        if (!originalResponse.ok) throw new Error("Não foi possível enviar a imagem original.");
      }

      const preview = await makePreview(sourceUrl, fit, cropPixels, rotation);
      const previewResponse = await fetch(`/api/sheets/${encodeURIComponent(targetSheetId)}/drawing`, {
        method: "PUT", credentials: "same-origin", cache: "no-store", redirect: "manual",
        headers: { ...headers, "Content-Type": preview.type || "image/webp" }, body: preview,
      });
      if (previewResponse.status === 401 || previewResponse.type === "opaqueredirect") {
        openLogin();
        throw new Error("Sua sessão expirou. Entre novamente.");
      }
      const responseType = previewResponse.headers.get("Content-Type") || "";
      const result = responseType.includes("application/json") ? await previewResponse.json() : {};
      if (!previewResponse.ok) {
        const message = previewResponse.status === 413 ? "A imagem excede o tamanho permitido."
          : previewResponse.status === 415 ? "Esse tipo de imagem não é aceito."
            : "Não foi possível enviar o desenho desta ficha.";
        throw new Error(message);
      }
      const updatedAt = result.drawing?.updatedAt || new Date().toISOString();
      onChange("desenho", JSON.stringify({ version: 1, updatedAt, fit, rotation,
        crop: fit === "cover" ? (cropPercent || drawing?.crop || null) : null }));
      setEditing(false);
      resetSource();
    } catch (uploadError) {
      setError(uploadError.message || "Não foi possível enviar o desenho desta ficha.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async event => {
    event.stopPropagation();
    if (!window.confirm("Remover o desenho desta ficha?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(baseUrl, {
        method: "DELETE", credentials: "same-origin", cache: "no-store", redirect: "manual",
        headers: { Accept: "application/json", "X-Ficha-Request": "1", "X-Ficha-Account": user.uid },
      });
      if (response.status === 401 || response.type === "opaqueredirect") {
        openLogin();
        throw new Error("Sua sessão expirou. Entre novamente.");
      }
      if (!response.ok && response.status !== 404) throw new Error("Não foi possível remover o desenho.");
      onChange("desenho", "");
    } catch (removeError) {
      setError(removeError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = event => {
    event.preventDefault();
    setDragging(false);
    beginFile(event.dataTransfer.files?.[0]);
  };

  const handleKeyDown = event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target !== event.currentTarget || drawing) return;
    event.preventDefault();
    inputRef.current?.click();
  };

  return (
    <>
      <div className={`drawing-space drawing-drop-area${drawing ? " has-drawing" : ""}${dragging ? " is-dragging" : ""}${busy ? " is-busy" : ""}`}
        onDragEnter={event => { event.preventDefault(); setDragging(true); }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
        onDrop={handleDrop} onKeyDown={handleKeyDown} tabIndex={drawing ? undefined : 0}
        role={drawing ? undefined : "button"} aria-label={drawing ? "Desenho do personagem" : "Adicionar desenho do personagem"}
        onClick={() => { if (!drawing && !busy) inputRef.current?.click(); }}>
        {drawing && imageUrl ? (
          <img className={`drawing-preview fit-${drawing.fit || "cover"}`} src={imageUrl} alt="Desenho do personagem" />
        ) : <span className="drawing-drop-hint">Arraste uma imagem aqui para enviar</span>}
        {busy && <span className="drawing-busy" role="status">Enviando imagem…</span>}
        {drawing && <div className="drawing-actions">
          <button type="button" onClick={event => { event.stopPropagation(); editExisting(); }} disabled={busy}>Editar imagem</button>
          <button type="button" onClick={remove} disabled={busy}>Remover</button>
        </div>}
        {error && <span className="drawing-error" role="alert">{error}</span>}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          hidden onClick={event => event.stopPropagation()}
          onChange={event => { beginFile(event.target.files?.[0]); event.target.value = ""; }} />
      </div>

      <dialog ref={dialogRef} className="drawing-editor-dialog" aria-labelledby="drawing-editor-title"
        onCancel={event => { event.preventDefault(); closeEditor(); }}
        onClick={event => { if (event.target === dialogRef.current) closeEditor(); }}>
        <header>
          <h2 id="drawing-editor-title">Ajustar desenho do personagem</h2>
          <button type="button" className="drawing-editor-close" onClick={closeEditor} disabled={busy} aria-label="Fechar">×</button>
        </header>
        <div className={`drawing-editor-stage fit-${fit}`} ref={stageRef}>
          {editorVisible && sourceUrl && (fit === "cover" ? (
            <Cropper image={sourceUrl} crop={crop} zoom={zoom} rotation={rotation} aspect={aspect}
              initialCroppedAreaPercentages={cropPercent || undefined}
              onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation}
              onCropComplete={(percentages, pixels) => { setCropPercent(percentages); setCropPixels(pixels); }}
              showGrid />
          ) : <img src={sourceUrl} alt="Prévia do desenho" />)}
        </div>
        <div className="drawing-editor-fit" role="group" aria-label="Como a imagem aparece no campo">
          <button type="button" className={fit === "cover" ? "selected" : ""} onClick={() => setFit("cover")}>Cortar para preencher</button>
          <button type="button" className={fit === "contain" ? "selected" : ""} onClick={() => setFit("contain")}>Ajustar inteira</button>
          <button type="button" className={fit === "fill" ? "selected" : ""} onClick={() => setFit("fill")}>Esticar</button>
        </div>
        {fit === "cover" && <div className="drawing-editor-controls">
          <label>Zoom <input type="range" min="1" max="3" step="0.01" value={zoom}
            onChange={event => setZoom(Number(event.target.value))} /></label>
          <label>Rotação <input type="range" min="-180" max="180" step="1" value={rotation}
            onChange={event => setRotation(Number(event.target.value))} /> <span>{rotation}°</span></label>
        </div>}
        {error && <p className="drawing-editor-error" role="alert">{error}</p>}
        <footer>
          <button type="button" onClick={closeEditor} disabled={busy}>Cancelar</button>
          <button type="button" onClick={upload} disabled={busy || (fit === "cover" && !cropPixels)}>
            {busy ? "Enviando…" : "Aplicar desenho"}
          </button>
        </footer>
      </dialog>
    </>
  );
}
