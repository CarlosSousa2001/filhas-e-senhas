import type { ServicePoint, ServicePointResponse } from './service-point.types.js';

export function toServicePointResponse(servicePoint: ServicePoint): ServicePointResponse {
  return {
    id: servicePoint.id,
    name: servicePoint.name,
    active: servicePoint.active,
  };
}
