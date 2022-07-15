import { createElement, mount } from 'cstk';
import { Api } from './api';
import { environment } from './config/environment';
import './main.scss';
import { AuthService } from './services/auth-service';

function Root({authService}: {
    authService: AuthService,
}) {
    return <div class='bezel'>
        <div class='display'>
            <div>Underground Tomorrow</div>
            <div>Bunker Administration Operating System</div>
            <div>Version 2.5</div>
            <div></div>
            <div>Username: <input type='text'/></div>
            <div>Password: <input type='text'/></div>
        </div>
    </div>;
}

const api = new Api(environment.apiUrl);
const authService = new AuthService(api);

mount(document.body, <Root authService={authService}/>)
