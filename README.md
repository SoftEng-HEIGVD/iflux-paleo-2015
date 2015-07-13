# iflux-paleo-2015

> Visualization of cars in and out of parkings

## Development setup

Create a `.env` file in the root directory of the project and put the following content:

```bash
PALEO_CAR_IN_ACTION_TYPE=http://localhost:3000/schemas/actionTypes/carIn
PALEO_CAR_OUT_ACTION_TYPE=http://localhost:3000/schemas/actionTypes/carOut

#####################################################################################################
# ONLY USED IN MODE WHERE IFLUX IS LOCALLY DEPLOYED AND MONGODB IS USED WITH DOCKER
#####################################################################################################
# MongoDB
MONGODB_HOST=<Boot2Docker IP>
MONGODB_PORT=27017
```

### Mandatory

| Name                       | Description                               |
| -------------------------- | ----------------------------------------- |
| PALEO_CAR_IN_ACTION_TYPE   | A car enters a parking action type. |
| PALEO_CAR_OUT_ACTION_TYPE  | A car goes out of a parking action type. |

### Optional

If you are using `Docker` you may have to configure this `MongoDB` info. Otherwise, it is supposed to
have a local installation of `MongoDB` automatically configured to `localhost:27017`

| Name                       | Description                               |
| -------------------------- | ----------------------------------------- |
| MONGODB_HOST               | Should be the Docker host IP (boot2docker IP, Vagrant VM IP, ...) |
| MONGODB_PORT               | Default port is 27017. |
