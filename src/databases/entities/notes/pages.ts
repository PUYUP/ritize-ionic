import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, type Relation } from 'typeorm';
import { Note } from './notes';

@Entity('pages')
export class Page {

    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    userId!: string;

    @Column()
    workspaceId!: string;

    @Column()
    workspaceNoteId!: string;

    @Column()
    pageNum!: number;

    @Column()
    isActive!: boolean;

    @Column('datetime', { nullable: true })
    syncedAt!: Date | null;

    @Column('uuid', { nullable: true })
    syncedId!: string | null;

    @Column({
        type: 'blob', // Gunakan 'bytea' jika menggunakan PostgreSQL
        nullable: true, // Set true jika halaman bisa tidak memiliki file/blob
        transformer: {
            to: (value?: Buffer | null): string | null =>
                value ? value.toString('base64') : null,
            from: (value?: string | null): Buffer | null =>
                value ? Buffer.from(value, 'base64') : null,
        },
    })
    contentData!: Buffer | null;

    @ManyToOne(() => Note, note => note.pages, {
        eager: false,
        cascade: ['insert'],
        onDelete: 'CASCADE'
    })
    note!: Relation<Partial<Note>>;

}