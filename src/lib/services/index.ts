/**
 * Service layer barrel export.
 * 
 * Import specific services:
 *   import { queryIncident } from '@/lib/services/incidents'
 *   import * as incidentService from '@/lib/services/incidents'
 * 
 * Or import everything (not recommended — tree-shaking risk):
 *   import * as services from '@/lib/services'
 */
export * as incidents from './incidents'
export * as encounters from './encounters'
export * as cs from './cs'
export * as mar from './mar'
export * as supplyRuns from './supplyRuns'
export * as ics214 from './ics214'
export * as employees from './employees'
export * as admin from './admin'
