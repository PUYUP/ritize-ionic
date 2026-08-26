import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, type Relation } from 'typeorm';
import { Note } from './notes';

@Entity('pages')
export class Page {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    pageNum!: number;

    @Column()
    isActive!: boolean;

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
    contentData!: Buffer;

    @ManyToOne(() => Note, note => note.pages, {
        eager: false,
        cascade: ['insert'],
        onDelete: 'CASCADE'
    })
    note!: Relation<Partial<Note>>;

}