import {
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonPage,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { useRef, useState } from "react";
import { useParams } from "react-router";
import { useDispatch } from "react-redux";
import { workspaceAPI } from "../../../services/workspace";
import WorkspacePageBlock from "../../../components/workspace-list/WorkspacePageBlock";
import { add } from "ionicons/icons";

interface RouteParams {
    id?: string;
    [key: string]: string | undefined;
}

const PER_PAGE = 25;

const WorkspacePage: React.FC = () => {
    const { id } = useParams<RouteParams>();
    const dispatch = useDispatch();

    // Hanya jumlah halaman & status "masih ada data lagi" — bukan data workspace itu sendiri
    const [pageCount, setPageCount] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const infiniteScrollRef = useRef<HTMLIonInfiniteScrollElement>(null);

    const handlePageLoaded = (page: number, itemCount: number) => {
        if (page === pageCount - 1) {
            setHasMore(itemCount === PER_PAGE);
        }
        infiniteScrollRef.current?.complete();
    };

    const handleLoadMore = () => {
        setPageCount((prev) => prev + 1);
    };

    // Refresh manual: invalidate tag, semua halaman yang sedang ter-mount otomatis refetch sendiri
    const handleRefresh = async (event: CustomEvent) => {
        await dispatch(workspaceAPI.util.invalidateTags([{ type: "Workspace", id: "LIST" }]));
        (event.target as HTMLIonRefresherElement).complete();
    };

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/dashboard" />
                    </IonButtons>
                    <IonTitle className="text-base text-center fixed left-6 right-6 top-0 bottom-0 text-lg">
                        My Workspaces
                    </IonTitle>
                    <IonButtons slot="end" className="ion-padding-end">
                        <IonButton fill="outline" size='small' mode="ios" shape='round' aria-label='Add workspace' routerLink={'/dashboard/editor/workspace'}>
                            <IonIcon icon={add} slot='icon-only' className='text-xl' />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent className="ion-padding-top">
                <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
                    <IonRefresherContent />
                </IonRefresher>

                {Array.from({ length: pageCount }).map((_, page) => {
                    return (
                        <WorkspacePageBlock
                            key={page}
                            page={page}
                            perPage={PER_PAGE}
                            onLoaded={handlePageLoaded}
                        />
                    )
                })}

                <IonInfiniteScroll
                    ref={infiniteScrollRef}
                    onIonInfinite={handleLoadMore}
                    threshold="100px"
                    disabled={!hasMore}
                >
                    <IonInfiniteScrollContent
                        loadingSpinner="bubbles"
                        loadingText="Memuat workspace lainnya..."
                    />
                </IonInfiniteScroll>
            </IonContent>
        </IonPage>
    );
};

export default WorkspacePage;