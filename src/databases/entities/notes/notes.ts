import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Page } from './pages';

@Entity('notes')
export class Note {

    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    userId!: string;

    @Column()
    workspaceId!: string;

    @Column({ nullable: true })
    title!: string;

    @Column({ nullable: true })
    content!: string;

    @Column()
    noteDatetime!: Date;

    @Column()
    contentType!: string;

    @OneToMany(() => Page, page => page.note)
    pages!: Page[];

    @Column('datetime', { nullable: true })
    syncedAt!: Date | null;

    @Column('uuid', { nullable: true })
    syncedId!: string | null;

    @Column('simple-json', { nullable: true })
    metadata!: Record<string, any> | null;

    @Column('varchar', { nullable: true, default: 'draft' })
    status!: 'draft' | 'published';

}