export type UserId=string&{readonly __brand:'UserId'};export type User={id:UserId;name:string;version:number};
export interface UserRepository{findById(id:UserId):Promise<User|null>;save(user:User):Promise<void>;delete(id:UserId):Promise<void>;}
export class InMemoryUserRepository implements UserRepository{private users=new Map<UserId,User>();async findById(id:UserId){const v=this.users.get(id);return v?structuredClone(v):null;}async save(user:User){this.users.set(user.id,structuredClone(user));}async delete(id:UserId){this.users.delete(id);}}
export const userId=(v:string)=>v as UserId;export const exerciseId='27.2';
