// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable,text,integer,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const records=sqliteTable('hs_records',{key:text('key').primaryKey(),value:text('value').notNull(),expires:integer('expires')});
export const events=sqliteTable('hs_events',{id:text('id').primaryKey(),owner:text('owner').notNull(),payload:text('payload').notNull(),version:integer('version').notNull().default(1)},t=>[index('hs_events_owner').on(t.owner)]);
export const members=sqliteTable('hs_members',{id:text('id').primaryKey(),eventId:text('event_id').notNull(),personId:text('person_id').notNull(),email:text('email').notNull(),userId:text('user_id')},t=>[uniqueIndex('hs_member_contact').on(t.eventId,t.email),index('hs_member_user').on(t.userId),index('hs_member_email').on(t.email)]);
export const operations=sqliteTable('hs_operations',{id:text('id').primaryKey(),eventId:text('event_id').notNull(),kind:text('kind').notNull(),state:text('state').notNull(),detail:text('detail').notNull(),created:integer('created').notNull()});
