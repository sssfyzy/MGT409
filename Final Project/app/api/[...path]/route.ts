import {env} from 'cloudflare:workers';
import {D1Repository} from '../../../backend/shared/repository.mjs';
import {Outlook} from '../../../backend/shared/outlook.mjs';
import {createService} from '../../../backend/shared/service.mjs';
export const dynamic='force-dynamic';
async function handle(request:Request){if(!env.DB)return Response.json({error:'Shared event storage is unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});const repo=new D1Repository(env.DB);return createService({repo,outlook:new Outlook(repo,env),environment:env})(request);}
export {handle as GET,handle as POST};
