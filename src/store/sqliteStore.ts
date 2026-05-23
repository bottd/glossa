import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface CommunityNoteInput {
  term: string; // normalized key
  display: string; // cased as the author input
  body: string;
  authorId: string;
  authorTag: string;
}

export interface CommunityNote extends CommunityNoteInput {
  id: number;
  createdAt: number;
}

export interface TagRef {
  tag: string; // normalized
  display: string;
}

export interface ReferenceInput {
  messageLink: string | null;
  sourceAuthorTag: string | null;
  addedBy: string;
  tags: TagRef[];
}

export interface Reference extends Omit<ReferenceInput, 'tags'> {
  id: number;
  createdAt: number;
  tags: TagRef[];
}

export interface ImageInput {
  term: string | null;
  referenceId: number | null;
  url: string; // Discord attachment URL (not re-hosted)
  addedBy: string;
}

export interface ImageRef extends ImageInput {
  id: number;
  createdAt: number;
}

export class SqliteStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS community_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        term TEXT NOT NULL,
        display TEXT NOT NULL,
        body TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_tag TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_community_notes_term ON community_notes(term);

      CREATE TABLE IF NOT EXISTS refs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_link TEXT,
        source_author_tag TEXT,
        added_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ref_tags (
        ref_id INTEGER NOT NULL REFERENCES refs(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        display TEXT NOT NULL,
        PRIMARY KEY (ref_id, tag)
      );
      CREATE INDEX IF NOT EXISTS idx_ref_tags_tag ON ref_tags(tag);

      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        term TEXT,
        reference_id INTEGER REFERENCES refs(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        added_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_images_term ON images(term);
    `);
  }

  async addCommunityNote(input: CommunityNoteInput): Promise<CommunityNote> {
    const createdAt = Date.now();
    const info = this.db
      .prepare(
        `INSERT INTO community_notes (term, display, body, author_id, author_tag, created_at)
         VALUES (@term, @display, @body, @authorId, @authorTag, @createdAt)`,
      )
      .run({ ...input, createdAt });
    return {
      ...input,
      id: Number(info.lastInsertRowid),
      createdAt,
    };
  }

  async getCommunityNotes(term: string): Promise<CommunityNote[]> {
    return this.db
      .prepare(
        `SELECT id, term, display, body,
                author_id AS authorId, author_tag AS authorTag, created_at AS createdAt
         FROM community_notes WHERE term = ? ORDER BY created_at ASC`,
      )
      .all(term) as CommunityNote[];
  }

  async addReference(input: ReferenceInput): Promise<Reference> {
    const createdAt = Date.now();
    const insertRef = this.db.prepare(
      `INSERT INTO refs (message_link, source_author_tag, added_by, created_at)
       VALUES (@messageLink, @sourceAuthorTag, @addedBy, @createdAt)`,
    );
    const insertTag = this.db.prepare(
      `INSERT OR IGNORE INTO ref_tags (ref_id, tag, display) VALUES (?, ?, ?)`,
    );

    const id = this.db.transaction(() => {
      const info = insertRef.run({ ...input, createdAt });
      const refId = Number(info.lastInsertRowid);
      for (const t of input.tags) insertTag.run(refId, t.tag, t.display);
      return refId;
    })();

    return { ...input, id, createdAt };
  }

  async getReferencesByTag(tag: string): Promise<Reference[]> {
    const rows = this.db
      .prepare(
        `SELECT r.id,
                r.message_link AS messageLink,
                r.source_author_tag AS sourceAuthorTag,
                r.added_by AS addedBy, r.created_at AS createdAt
         FROM refs r
         JOIN ref_tags rt ON rt.ref_id = r.id
         WHERE rt.tag = ? ORDER BY r.created_at DESC`,
      )
      .all(tag) as Omit<Reference, 'tags'>[];

    if (rows.length === 0) return [];

    // Fetch every matched reference's tags in one query, then group in memory.
    const placeholders = rows.map(() => '?').join(', ');
    const tagRows = this.db
      .prepare(
        `SELECT ref_id AS refId, tag, display
         FROM ref_tags WHERE ref_id IN (${placeholders})`,
      )
      .all(...rows.map((row) => row.id)) as (TagRef & { refId: number })[];

    const tagsByRef = new Map<number, TagRef[]>();
    for (const { refId, tag, display } of tagRows) {
      const list = tagsByRef.get(refId) ?? [];
      list.push({ tag, display });
      tagsByRef.set(refId, list);
    }

    return rows.map((row) => ({ ...row, tags: tagsByRef.get(row.id) ?? [] }));
  }

  async addImage(input: ImageInput): Promise<ImageRef> {
    const createdAt = Date.now();
    const info = this.db
      .prepare(
        `INSERT INTO images (term, reference_id, url, added_by, created_at)
         VALUES (@term, @referenceId, @url, @addedBy, @createdAt)`,
      )
      .run({ ...input, createdAt });
    return { ...input, id: Number(info.lastInsertRowid), createdAt };
  }

  async getImagesForTerm(term: string): Promise<ImageRef[]> {
    // Images attached directly to the term, plus images on references tagged
    // with it (reference images are stored once, not per tag).
    return this.db
      .prepare(
        `SELECT i.id, i.term, i.reference_id AS referenceId, i.url,
                i.added_by AS addedBy, i.created_at AS createdAt
         FROM images i
         LEFT JOIN ref_tags rt ON rt.ref_id = i.reference_id
         WHERE i.term = ? OR rt.tag = ?
         GROUP BY i.id
         ORDER BY i.created_at ASC`,
      )
      .all(term, term) as ImageRef[];
  }

  async searchTerms(query: string, limit = 25): Promise<string[]> {
    const like = `%${query}%`;
    const rows = this.db
      .prepare(
        `SELECT display, MIN(term) AS term FROM (
           SELECT display, term FROM community_notes
           UNION ALL
           SELECT display, tag AS term FROM ref_tags
         ) WHERE term LIKE ? COLLATE NOCASE GROUP BY term ORDER BY display ASC LIMIT ?`,
      )
      .all(like, limit) as { display: string }[];
    return rows.map((r) => r.display);
  }

  close(): void {
    this.db.close();
  }
}
