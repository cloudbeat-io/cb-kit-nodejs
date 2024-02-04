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
        config.headers['Content-Type'] = 'application/json';
        // TODO:
        //      Should add support for X-Api-Key header
        //      Should remove support for Bearer token (backend doesn't seem to support it?)
        //      Should eventually remove support for apiKey URL query parameter
        if (this.authType === AuthenticationType.Bearer) {
            config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        else {
            const params = new URLSearchParams({
                apiKey: this.authToken,
            });

            // append random parameter to each GET request to prevent caching proxies interfering with our requests
            if (config.method === 'get') {
                params.append('rnd', Math.floor(Math.random() * 1000000000000).toString());
            }

            // append query string to the url
            if (config.url?.endsWith('?') && config.url?.endsWith('&')) {
                config.url += '?';
            }
            config.url += params.toString();
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
