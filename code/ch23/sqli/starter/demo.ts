export function unsafeQuery(input:string){return `SELECT id, name FROM users WHERE name = '${input}'`}
// TODO: parameterized query and attack demonstration.
