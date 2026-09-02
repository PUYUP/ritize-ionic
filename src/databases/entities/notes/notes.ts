import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { Page } from './pages';

@Entity('notes')
export class Note {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    userId!: string;

    @Column()
    workspaceId!: string;

    @Column()
    title!: string;

    @Column()
    content!: string;

    @Column()
    noteDatetime!: Date;

    @Column()
    contentType!: string;

    @OneToMany(() => Page, page => page.note)
    pages!: Page[];

    @Column('datetime', { nullable: true })
    syncedAt!: Date | null;

}