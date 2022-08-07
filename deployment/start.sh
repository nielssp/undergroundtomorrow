#!/bin/bash
docker run --rm --name undergroundtomorrow -p 8080:8080 --env-file /svr/env nielssp/undergroundtomorrow
