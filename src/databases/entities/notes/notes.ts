import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { Page } from './pages';

@Entity('notes')
export class Note {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    workspaceId!: string;

    @OneToMany(() => Page, page => page.note)
    pages!: Page[];

}