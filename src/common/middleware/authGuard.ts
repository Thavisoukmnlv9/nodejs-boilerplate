/**
 * Bearer-token gate. The implementation lives in the access library
 * (`@/access/guards`); re-exported here so existing `@/common/middleware` imports
 * and the middleware barrel keep resolving.
 */
export { authGuard } from '@/access/guards';
