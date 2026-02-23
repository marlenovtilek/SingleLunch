/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PaginatedDepartmentList } from '../models/PaginatedDepartmentList';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class DepartmentsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * @param page A page number within the paginated result set.
     * @returns PaginatedDepartmentList
     * @throws ApiError
     */
    public departmentsList(
        page?: number,
    ): CancelablePromise<PaginatedDepartmentList> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/departments/',
            query: {
                'page': page,
            },
        });
    }
}
