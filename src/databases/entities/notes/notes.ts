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
    learningSessionId!: string;

    @Column({ nullable: true })
    title!: string;

    @Column({ nullable: true })
    content!: string;

    @Column('varchar', { nullable: true })
    noteDatetime!: string | null;

    @Column()
    contentType!: string;

    @OneToMany(() => Page, page => page.note)
    pages!: Page[];

    @Column('varchar', { nullable: true })
    syncedAt!: string | null;

    @Column('varchar', { nullable: true })
    createdAt!: string | null;

    @Column('uuid', { nullable: true })
    syncedId!: string | null;

    @Column('simple-json', { nullable: true })
    attributes!: Record<string, any> | null;

    @Column('varchar', { nullable: true, default: 'draft' })
    status!: 'draft' | 'published';

    @Column('varchar', { nullable: true, default: 'pending' })
    processingStatus!: 'pending' | 'processed';

}