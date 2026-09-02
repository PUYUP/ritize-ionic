import { useEffect } from "react";
import { IonSpinner } from "@ionic/react";
import { useGetAllWorkspacesQuery } from "../../services/workspace";
import WorkspaceList from "./WorkspaceList";

interface WorkspacePageBlockProps {
    page: number;
    perPage: number;
    onLoaded: (page: number, itemCount: number) => void;
}

const WorkspacePageBlock: React.FC<WorkspacePageBlockProps> = ({ page, perPage, onLoaded }) => {
    const from = page * perPage;
    const to = from + perPage - 1;

    // Setiap instance komponen ini = cache entry sendiri di RTK Query.
    // providesTags "LIST" di endpoint bikin tiap halaman auto-refetch
    // saat ada create/update/delete workspace di manapun.
    const { data: items, isFetching, isSuccess } = useGetAllWorkspacesQuery({ from, to });

    useEffect(() => {
        if (isSuccess) {
            onLoaded(page, items?.length ?? 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSuccess, items]);

    if (isFetching && !items) {
        return (
            <div className="ion-text-center ion-padding">
                <IonSpinner name="crescent" />
            </div>
        );
    }

    return <WorkspaceList items={items ?? []} />;
};

export default WorkspacePageBlock;