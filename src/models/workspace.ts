export interface WorkspaceItem {
    readonly id: number;
    title: string;
    icon?: string;
    color?: string;
    scope: 'personal' | 'group';
    memberCount: number;
    todayNoteCount: number;
}