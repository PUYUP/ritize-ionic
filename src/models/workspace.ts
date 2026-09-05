export interface WorkspaceItem {
    readonly id: number;
    title: string;
    icon?: string;
    color?: string;
    scope: 'personal' | 'group';
    member_count: number;
    today_note_count: number;
}