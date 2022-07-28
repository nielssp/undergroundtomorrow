import { ApiError } from "./api";
import { openAlert } from "./dialog";

export function handleError(error: ApiError|any) {
    if (error.status === 401) {
        openAlert('You have been logged out');
    } else if (error.status === 403) {
        openAlert('Not allowed to access resource');
    } else if (error.status === 404) {
        openAlert('Resource not found');
    } else {
        console.error(error);
        openAlert('Unknown server error');
    }
}
