# iflux-paleo-2015

> Visualization of cars in and out of parkings

## Development setup

Create a `.env` file in the root directory of the project and put the following content:

```bash
PALEO_CAR_IN_ACTION_TYPE=http://localhost:3000/schemas/actionTypes/carIn
PALEO_CAR_OUT_ACTION_TYPE=http://localhost:3000/schemas/actionTypes/carOut
```

### Mandatory

| Name                       | Description                               |
| -------------------------- | ----------------------------------------- |
| PALEO_CAR_IN_ACTION_TYPE   | A car enters a parking action type. |
| PALEO_CAR_OUT_ACTION_TYPE  | A car goes out of a parking action type. |
