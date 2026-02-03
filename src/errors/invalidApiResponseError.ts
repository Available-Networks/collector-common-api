export default class InvalidAPIResponseError extends Error {
    private _route: string;
    private _data: any;

    public get route() {
        return this._route;
    }

    public get data() {
        return this._data;
    }

    constructor(route: string, data: any) {
        const message = `API route '${route}' returned invalid data: ${JSON.stringify(data)}`;

        super(message);
        
        this._route = route;
        this._data = data;
    }
}