import { URLSearchParams } from 'url';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import Debug from 'debug';

const debug = Debug('RuntimeApi');

// eslint-disable-next-line no-shadow
export enum AuthenticationType {
    Bearer,
    ApiKey
}

export class CbRestApiClient {
    protected readonly instance: AxiosInstance;
    protected readonly authToken: string;
    protected readonly authType: AuthenticationType;

    public constructor(baseUrl: string, authToken: string, authType: AuthenticationType = AuthenticationType.Bearer) {
        this.instance = axios.create({
          baseURL: baseUrl,
        });
        this.authToken = authToken;
        this.authType = authType;

        this._initializeRequestInterceptor();
        this._initializeResponseInterceptor();
    }

    protected _handleRequest = (config: InternalAxiosRequestConfig) => {
        if (!config.headers['Content-Type'] && !config.headers['content-type']) {
            config.headers['Content-Type'] = 'application/json';
        }
        if (this.authType === AuthenticationType.Bearer) {
            config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        else {
            // the key is sent as a header and never as a query parameter: URLs end up in access logs, proxies and browser history
            config.headers['X-Api-Key'] = this.authToken;

            // append random parameter to each GET request to prevent caching proxies interfering with our requests
            if (config.method === 'get') {
                const params = new URLSearchParams({
                    rnd: Math.floor(Math.random() * 1000000000000).toString(),
                });
                config.url += `${config.url?.includes('?') ? '&' : '?'}${params.toString()}`;
            }
        }
        // log request
        debug(`REQ: ${config.method!} ${config.url!}`);
        return config;
    };

    protected _handleResponse = (response: AxiosResponse) => {
        const { data } = response;
        // log response
        debug(`RES: HTTP ${response.status} ${data ? JSON.stringify(data) : ''}`);
        return data;
    };

    protected _handleError = (error: any) => Promise.reject(error);

    private _initializeRequestInterceptor = () => {
        this.instance.interceptors.request.use(
            this._handleRequest,
            this._handleError,
        );
    };

    private _initializeResponseInterceptor = () => {
        this.instance.interceptors.response.use(
            this._handleResponse,
            this._handleError,
        );
    };
}
