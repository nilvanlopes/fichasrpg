.PHONY: dev dev-logs dev-api-logs dev-stop

dev:
	-docker rm -f fichasrpg-dev >/dev/null 2>&1
	-docker service rm fichasrpg_dev_api >/dev/null 2>&1
	-docker network create --driver overlay --attachable --internal fichasrpg-dev >/dev/null 2>&1
	-docker network inspect floci-internal >/dev/null 2>&1 || docker network create --driver overlay --attachable --internal floci-internal
	docker build --target api-dev -t fichasrpg-dev-api:local .
	docker service create --name fichasrpg_dev_api --network fichasrpg-dev --network fichasrpg_database --network floci-internal --constraint 'node.hostname==pyuserver' --mount type=bind,source="$(CURDIR)/server",target=/app/server,readonly --secret 'source=fichasrpg_db_password,target=fichasrpg_db_password,uid=1000,gid=1000,mode=0400' --env-file "$(CURDIR)/.env" --env DB_HOST=postgres --env DB_NAME=fichasrpg_dev --env DB_USER=fichasrpg --env DB_PASSWORD_FILE=/run/secrets/fichasrpg_db_password --env PUBLIC_ORIGIN=http://fichasrpg.localnetwork --env DEV_AUTH_BYPASS=1 --env DEV_AUTH_USERNAME=pyu --env FLOCI_S3_ENDPOINT=http://floci:4566 --env FLOCI_S3_BUCKET=fichasrpg-drawings --env FLOCI_S3_REGION=us-east-1 --env FLOCI_S3_ACCESS_KEY_ID=test --env FLOCI_S3_SECRET_ACCESS_KEY=test fichasrpg-dev-api:local
	docker run -d --name fichasrpg-dev --network traefik-local --network-alias fichasrpg-dev -v "$(CURDIR):/app" -v fichasrpg_node_modules:/app/node_modules -w /app node:24-alpine sh -lc 'if [ ! -x node_modules/.bin/vite ]; then npm install; fi; npm run dev -- --host 0.0.0.0'
	docker network connect fichasrpg-dev fichasrpg-dev

dev-logs:
	docker logs -f fichasrpg-dev

dev-api-logs:
	docker service logs -f fichasrpg_dev_api

dev-stop:
	docker rm -f fichasrpg-dev
	-docker service rm fichasrpg_dev_api >/dev/null 2>&1
