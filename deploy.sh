#!/bin/bash
docker build -t nielssp/undergroundtomorrow:latest . || exit 1
docker save -o image.tar nielssp/undergroundtomorrow || exit 1
npm run build || exit 1
rsync -avz ./landing/ niels@undergroundtomorrow.com:/svr/landing || exit 1
rsync -avz ./dist/ niels@undergroundtomorrow.com:/svr/client || exit 1
rsync -avz ./image.tar niels@undergroundtomorrow.com:/svr/ || exit 1
rsync -avz ./deployment/start.sh niels@undergroundtomorrow.com:/svr/ || exit 1
rsync -avz ./deployment/ut.service niels@undergroundtomorrow.com:/svr/ || exit 1
ssh niels@undergroundtomorrow.com 'docker load -i /svr/image.tar' || exit 1
#ssh niels@undergroundtomorrow.com 'sudo systemctl restart ut' || exit 1
#docker -H "ssh://niels@undergroundtomorrow.com" run --rm nielssp/undergroundtomorrow
