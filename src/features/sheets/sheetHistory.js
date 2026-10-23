export function sameForm(left, right) {
  if (left === right) return true;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.hasOwn(right, key) && Object.is(left[key], right[key]));
}

export class SheetHistory {
  constructor(form = {}, limit = 100) {
    this.limit = limit;
    this.reset(form);
  }

  reset(form) {
    this.form = form;
    this.saved = form;
    this.past = [];
    this.future = [];
    this.breakGroup();
  }

  get flags() { return { canUndo: this.past.length > 0, canRedo: this.future.length > 0 }; }
  get dirty() { return !sameForm(this.form, this.saved); }
  markSaved(form) { this.saved = form; }

  breakGroup() {
    this.batch = null;
    this.groupKey = null;
    this.groupTime = 0;
  }

  endBatch(batch) {
    if (this.batch === batch) this.batch = null;
  }

  record(form, { batch = null, groupKey = null, now = Date.now() } = {}) {
    if (sameForm(form, this.form)) return false;
    const sameBatch = batch && batch === this.batch;
    const sameTyping = groupKey && groupKey === this.groupKey && now - this.groupTime < 750 && !this.future.length;
    if (!sameBatch && !sameTyping) {
      this.past.push(this.form);
      if (this.past.length > this.limit) this.past.shift();
    }
    this.form = form;
    this.future = [];
    this.batch = batch;
    this.groupKey = groupKey;
    this.groupTime = now;
    return true;
  }

  undo() {
    if (!this.past.length) return false;
    this.future.push(this.form);
    this.form = this.past.pop();
    this.breakGroup();
    return true;
  }

  redo() {
    if (!this.future.length) return false;
    this.past.push(this.form);
    this.form = this.future.pop();
    this.breakGroup();
    return true;
  }
}
