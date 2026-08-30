import {
  integer,
  sqliteTable,
  text,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  archivedAt: text('archived_at'),
  deletedAt: text('deleted_at'),
};
export const members = sqliteTable(
  'members',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    lineName: text('line_name'),
    email: text('email'),
    status: text('status', {
      enum: ['candidate', 'invited', 'active', 'pause', 'churned'],
    }).notNull(),
    joinedAt: text('joined_at'),
    source: text('source'),
    lastContactAt: text('last_contact_at'),
    interestCategories: text('interest_categories', { mode: 'json' }),
    notes: text('notes'),
    kaihipayCustomerId: text('kaihipay_customer_id'),
    ...timestamps,
  },
  (t) => [
    index('idx_members_status').on(t.status),
    index('idx_members_email').on(t.email),
  ],
);
export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    eventType: text('event_type').notNull(),
    description: text('description'),
    startAt: text('start_at').notNull(),
    endAt: text('end_at').notNull(),
    venue: text('venue').notNull(),
    capacity: integer('capacity').notNull(),
    price: integer('price').notNull(),
    memberOnly: integer('member_only', { mode: 'boolean' }).notNull(),
    registrationEnabled: integer('registration_enabled', {
      mode: 'boolean',
    }).notNull(),
    waitlistEnabled: integer('waitlist_enabled', { mode: 'boolean' }).notNull(),
    publishStatus: text('publish_status').notNull(),
    publicVisible: integer('public_visible', { mode: 'boolean' }).notNull(),
    memberVisible: integer('member_visible', { mode: 'boolean' }).notNull(),
    coverImage: text('cover_image'),
    itemsToBring: text('items_to_bring'),
    precautions: text('precautions'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('idx_events_slug').on(t.slug),
    index('idx_events_start').on(t.startAt),
  ],
);
export const eventApplications = sqliteTable(
  'event_applications',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    memberId: text('member_id').references(() => members.id),
    name: text('name').notNull(),
    email: text('email').notNull(),
    lineName: text('line_name'),
    memberType: text('member_type').notNull(),
    appliedAt: text('applied_at').notNull(),
    applicationStatus: text('application_status').notNull(),
    paymentStatus: text('payment_status').notNull(),
    cancelledAt: text('cancelled_at'),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [index('idx_app_event_status').on(t.eventId, t.applicationStatus)],
);
export const eventPayments = sqliteTable(
  'event_payments',
  {
    id: text('id').primaryKey(),
    applicationId: text('application_id')
      .notNull()
      .references(() => eventApplications.id),
    amount: integer('amount').notNull(),
    status: text('status').notNull(),
    paidAt: text('paid_at'),
    refundedAt: text('refunded_at'),
    ...timestamps,
  },
  (t) => [index('idx_payments_status').on(t.status)],
);
export const contents = sqliteTable(
  'contents',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    summary: text('summary'),
    body: text('body').notNull(),
    tags: text('tags', { mode: 'json' }),
    coverImage: text('cover_image'),
    audio: text('audio'),
    publishStatus: text('publish_status').notNull(),
    publicVisible: integer('public_visible', { mode: 'boolean' }).notNull(),
    memberVisible: integer('member_visible', { mode: 'boolean' }).notNull(),
    publishedAt: text('published_at'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('idx_contents_slug').on(t.slug),
    index('idx_contents_listing').on(t.type, t.publishStatus),
  ],
);
export const contentMedia = sqliteTable('content_media', {
  id: text('id').primaryKey(),
  contentId: text('content_id').references(() => contents.id),
  r2Key: text('r2_key').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  alt: text('alt'),
  createdAt: text('created_at').notNull(),
});
export const contentPlacements = sqliteTable(
  'content_placements',
  {
    id: text('id').primaryKey(),
    contentId: text('content_id')
      .notNull()
      .references(() => contents.id),
    surface: text('surface').notNull(),
    position: integer('position').notNull(),
    featured: integer('featured', { mode: 'boolean' }).notNull(),
    pinned: integer('pinned', { mode: 'boolean' }).notNull(),
    isNew: integer('is_new', { mode: 'boolean' }).notNull(),
    archivedAt: text('archived_at'),
  },
  (t) => [index('idx_placements_surface_position').on(t.surface, t.position)],
);
export const analyticsEvents = sqliteTable(
  'analytics_events',
  {
    id: text('id').primaryKey(),
    eventType: text('event_type').notNull(),
    sessionId: text('session_id').notNull(),
    path: text('path').notNull(),
    entityId: text('entity_id'),
    occurredAt: text('occurred_at').notNull(),
  },
  (t) => [index('idx_analytics_type_date').on(t.eventType, t.occurredAt)],
);
export const analyticsDaily = sqliteTable(
  'analytics_daily',
  {
    day: text('day').notNull(),
    metric: text('metric').notNull(),
    dimension: text('dimension').notNull(),
    value: integer('value').notNull(),
  },
  (t) => [
    uniqueIndex('idx_analytics_daily_unique').on(t.day, t.metric, t.dimension),
  ],
);
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const adminUsers = sqliteTable(
  'admin_users',
  {
    id: text('id').primaryKey(),
    accessEmail: text('access_email').notNull(),
    role: text('role', { enum: ['owner', 'editor', 'viewer'] }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('idx_admin_email').on(t.accessEmail)],
);
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    before: text('before', { mode: 'json' }),
    after: text('after', { mode: 'json' }),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_audit_entity').on(t.entityType, t.entityId),
    index('idx_audit_created').on(t.createdAt),
  ],
);
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    readAt: text('read_at'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_notifications_unread').on(t.readAt)],
);
