import { IonButton, IonButtons, IonCard, IonCardContent, IonIcon, IonText } from '@ionic/react';
import { format } from 'date-fns';
import './NoteList.css';
import { ellipsisHorizontal, ellipsisVertical } from 'ionicons/icons';

interface Props {
    workspaceId: number;
}

interface Note {
    readonly id: number;
    contentData: any;
    createdAt: string;
    user: {
        id: number;
        name: string;
    }
}

const notes: Note[] = [
    {
        id: 1,
        contentData: {
            text: "Pengantar integral dan konsep luas di bawah kurva. Integral dapat dipahami sebagai proses menjumlahkan bagian-bagian kecil yang sangat banyak untuk mendapatkan nilai total. Dalam konteks geometri, integral tentu dapat digunakan untuk menghitung luas daerah yang dibatasi oleh kurva fungsi, sumbu x, dan batas tertentu."
        },
        createdAt: "2026-08-28T09:15:00Z",
        user: {
            id: 1,
            name: 'John Doe'
        }
    },
    {
        id: 2,
        contentData: {
            text: "Rumus dasar integral tentu. Jika suatu fungsi f(x) memiliki antiturunan F(x), maka integral dari f(x) pada interval [a,b] dapat dihitung menggunakan F(b) - F(a). Konsep ini dikenal sebagai Teorema Dasar Kalkulus dan menghubungkan proses diferensiasi dengan integrasi."
        },
        createdAt: "2026-08-28T11:30:00Z",
        user: {
            id: 2,
            name: 'Jane Doe'
        }
    },
    {
        id: 3,
        contentData: {
            text: "Contoh soal integral fungsi polinomial. Untuk menghitung integral dari fungsi seperti 3x² + 2x - 5, setiap suku dapat diintegralkan secara terpisah menggunakan aturan pangkat. Hasil integral kemudian ditambah dengan konstanta C untuk integral tak tentu. Untuk integral tentu, kita cukup memasukkan batas atas dan batas bawah ke dalam fungsi antiturunannya."
        },
        createdAt: "2026-08-28T14:20:00Z",
        user: {
            id: 3,
            name: 'John Doe'
        }
    },

    {
        id: 4,
        contentData: {
            text: "Turunan sebagai laju perubahan. Turunan suatu fungsi menunjukkan bagaimana nilai fungsi berubah ketika variabel input mengalami perubahan kecil. Secara geometris, turunan dapat diinterpretasikan sebagai kemiringan garis singgung pada suatu titik di kurva. Dalam fisika, konsep ini sering digunakan untuk mencari kecepatan dari posisi dan percepatan dari kecepatan."
        },
        createdAt: "2026-08-27T08:45:00Z",
        user: {
            id: 4,
            name: 'John Doe'
        }
    },
    {
        id: 5,
        contentData: {
            text: "Hubungan turunan dan integral sangat penting dalam kalkulus. Turunan dapat dianggap sebagai proses mencari laju perubahan, sedangkan integral dapat digunakan untuk mengakumulasi perubahan tersebut. Teorema Dasar Kalkulus menunjukkan bahwa kedua operasi ini pada dasarnya merupakan kebalikan satu sama lain dalam kondisi tertentu."
        },
        createdAt: "2026-08-27T10:10:00Z",
        user: {
            id: 5,
            name: 'John Doe'
        }
    },
    {
        id: 6,
        contentData: {
            text: "Latihan menghitung turunan fungsi trigonometri. Turunan sin(x) adalah cos(x), sedangkan turunan cos(x) adalah -sin(x). Untuk fungsi yang lebih kompleks, aturan rantai dapat digunakan dengan terlebih dahulu menentukan fungsi luar dan fungsi dalam. Kesalahan yang sering terjadi adalah lupa mengalikan dengan turunan fungsi dalam."
        },
        createdAt: "2026-08-27T15:00:00Z",
        user: {
            id: 6,
            name: 'John Doe'
        }
    },

    {
        id: 7,
        contentData: {
            text: "Konsep limit dan kekontinuan fungsi. Limit menjelaskan nilai yang didekati oleh suatu fungsi ketika variabel mendekati nilai tertentu. Nilai limit tidak selalu sama dengan nilai fungsi pada titik tersebut. Sebuah fungsi dikatakan kontinu pada suatu titik jika nilai fungsi, limit dari kiri, dan limit dari kanan semuanya memiliki nilai yang sama."
        },
        createdAt: "2026-08-26T09:00:00Z",
        user: {
            id: 7,
            name: 'John Doe'
        }
    },
    {
        id: 8,
        contentData: {
            text: "Limit fungsi ketika x mendekati suatu nilai dapat dihitung dengan substitusi langsung jika fungsi tersebut tidak menghasilkan bentuk tak tentu. Jika muncul bentuk seperti 0/0, diperlukan metode lain seperti faktorisasi, penyederhanaan aljabar, atau menggunakan aturan L'Hopital pada kondisi yang sesuai."
        },
        createdAt: "2026-08-26T12:25:00Z",
        user: {
            id: 8,
            name: 'John Doe'
        }
    },
    {
        id: 9,
        contentData: {
            text: "Contoh soal limit tak hingga. Ketika x menuju tak hingga, perilaku fungsi polinomial biasanya ditentukan oleh suku dengan pangkat tertinggi. Untuk fungsi rasional, perbandingan derajat pembilang dan penyebut dapat digunakan untuk menentukan apakah limitnya menuju nol, suatu konstanta, atau tak hingga. Konsep ini juga membantu memahami perilaku grafik fungsi pada jarak yang sangat jauh."
        },
        createdAt: "2026-08-26T16:40:00Z",
        user: {
            id: 9,
            name: 'John Doe'
        }
    },

    {
        id: 10,
        contentData: {
            text: "Penerapan kalkulus dalam masalah fisika. Turunan digunakan untuk menggambarkan perubahan posisi terhadap waktu, sehingga dapat digunakan untuk memperoleh kecepatan dan percepatan. Sebaliknya, integral dapat digunakan untuk mendapatkan perpindahan dari fungsi kecepatan. Hal ini menunjukkan bahwa konsep kalkulus bukan hanya teori matematika, tetapi juga menjadi dasar untuk memodelkan berbagai fenomena fisik."
        },
        createdAt: "2026-08-25T13:15:00Z",
        user: {
            id: 10,
            name: 'John Doe'
        }
    },
];

const NoteItem: React.FC<{ item: Note }> = ({ item }) => {
    const { contentData, createdAt } = item;

    return (
        <div className='block'>
            <div className='flex'>
                <div className='flex flex-col'>
                    <div className='flex gap-1'>
                        <IonText className='text-xs text-neutral-500 uppercase'>{format(item.createdAt, 'MMM dd, yy')}</IonText>
                        <IonText className='text-xs text-neutral-400'>&bull;</IonText>
                        <IonText className='text-xs text-neutral-500 uppercase'>{format(item.createdAt, 'HH:mm')}</IonText>
                    </div>
                    <IonText className='font-semibold text-base'>{item.user.name}</IonText>
                </div>

                <div className='ml-auto'>
                    <IonButton shape='round' size='small' color={'medium'} fill='clear'>
                        <IonIcon icon={ellipsisVertical} slot='icon-only' />
                    </IonButton>

                </div>
            </div>
            <div
                dangerouslySetInnerHTML={{ __html: contentData.text }}
                className='text-neutral-700 text-base leading-6'
            />
        </div>
    )
}

const NoteList: React.FC<Props> = ({ workspaceId }) => {
    return (
        <div id="notelist" className='flex flex-col gap-6'>
            {notes.map((item) => (
                <NoteItem key={item.id} item={item} />
            ))}
        </div>
    )
}

export default NoteList;