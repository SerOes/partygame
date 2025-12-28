import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Turkish Films & Series terms - all in Turkish!
const TURKISH_FILM_TERMS = [
    // Difficulty 1 - Very Easy (everyone knows)
    { term: 'Şirinler', difficulty: 1, forbiddenWords: ['Mavi', 'Küçük', 'Köy', 'Çizgi film', 'Mantar'], hint: 'Mavi cüceler', type: 'EXPLAIN' },
    { term: 'Muhteşem Yüzyıl', difficulty: 1, forbiddenWords: ['Osmanlı', 'Sultan', 'Hürrem', 'Dizi', 'Tarih'], hint: 'Kanuni Sultan Süleyman dizisi', type: 'EXPLAIN' },
    { term: 'Kurtlar Vadisi', difficulty: 1, forbiddenWords: ['Polat', 'Alemdar', 'Mafya', 'Dizi', 'Aksiyon'], hint: 'Ünlü Türk aksiyon dizisi', type: 'EXPLAIN' },
    { term: 'Keloğlan', difficulty: 1, forbiddenWords: ['Kel', 'Masal', 'Çocuk', 'Türk', 'Çizgi film'], hint: 'Türk masallarının kel kahramanı', type: 'PANTOMIME' },
    { term: 'Çocuklar Duymasın', difficulty: 1, forbiddenWords: ['Komedi', 'Aile', 'Dizi', 'Gülmek', 'Eşler'], hint: 'Uzun yıllar yayınlanan aile komedisi', type: 'EXPLAIN' },
    { term: 'Recep İvedik', difficulty: 1, forbiddenWords: ['Şahan', 'Komedi', 'Film', 'Türk', 'Gülmek'], hint: 'Türkiyenin en çok izlenen komedi filmi', type: 'PANTOMIME' },
    { term: 'Hababam Sınıfı', difficulty: 1, forbiddenWords: ['Okul', 'Öğrenci', 'Komedi', 'Eski', 'Sınıf'], hint: 'Efsanevi Türk okul komedisi', type: 'EXPLAIN' },
    { term: 'Aşk-ı Memnu', difficulty: 1, forbiddenWords: ['Yasak', 'Aşk', 'Dizi', 'Beren', 'Roman'], hint: 'Halit Ziya Uşaklıgilin romanından uyarlama', type: 'EXPLAIN' },
    { term: 'Ezel', difficulty: 1, forbiddenWords: ['Intikam', 'Dizi', 'Kenan', 'Hapishane', 'Arkadaş'], hint: 'Ünlü intikam dizisi', type: 'EXPLAIN' },
    { term: 'Film izlemek', difficulty: 1, forbiddenWords: ['Sinema', 'Ekran', 'Oturmak', 'Seyretmek', 'TV'], hint: 'Akşamları ne yaparsın?', type: 'PANTOMIME' },

    // Difficulty 2 - Easy
    { term: 'Çukur', difficulty: 2, forbiddenWords: ['Mahalle', 'Mafya', 'Aile', 'İstanbul', 'Koçovalı'], hint: 'İstanbulda bir mahalle dizisi', type: 'EXPLAIN' },
    { term: 'İçerde', difficulty: 2, forbiddenWords: ['Polis', 'Mafya', 'Ajan', 'Dizi', 'Gizli'], hint: 'Polis ve mafya dizisi', type: 'EXPLAIN' },
    { term: 'Fatih Harbiye', difficulty: 2, forbiddenWords: ['İstanbul', 'Zengin', 'Fakir', 'Aşk', 'Dizi'], hint: 'İki farklı dünya arasında aşk', type: 'EXPLAIN' },
    { term: 'Diriliş Ertuğrul', difficulty: 2, forbiddenWords: ['Osmanlı', 'Savaş', 'Türk', 'Tarih', 'Kayı'], hint: 'Osmanlı kuruluş dizisi', type: 'EXPLAIN' },
    { term: 'Yaprak Dökümü', difficulty: 2, forbiddenWords: ['Aile', 'Drama', 'Dizi', 'Baba', 'Kız'], hint: 'Aile dramı dizisi', type: 'EXPLAIN' },
    { term: 'Karadayı', difficulty: 2, forbiddenWords: ['Mafya', 'Baba', 'İstanbul', 'Dizi', 'Koruma'], hint: '60larda geçen mafya dizisi', type: 'EXPLAIN' },
    { term: 'Elif', difficulty: 2, forbiddenWords: ['Çocuk', 'Kız', 'Dizi', 'Drama', 'Anne'], hint: 'Küçük kızın hikayesi', type: 'EXPLAIN' },
    { term: 'Geniş Aile', difficulty: 2, forbiddenWords: ['Komedi', 'Aile', 'Dizi', 'Akraba', 'Ev'], hint: 'Kalabalık aile komedisi', type: 'EXPLAIN' },
    { term: 'Kara Sevda', difficulty: 2, forbiddenWords: ['Aşk', 'Drama', 'Dizi', 'Zengin', 'Fakir'], hint: 'Uluslararası Emmy kazanan dizi', type: 'EXPLAIN' },
    { term: 'Popcorn', difficulty: 2, forbiddenWords: ['Mısır', 'Sinema', 'Yemek', 'Tuzlu', 'Film'], hint: 'Sinemada ne yenir?', type: 'DRAW' },

    // Difficulty 3 - Medium
    { term: 'Bir Zamanlar Çukurova', difficulty: 3, forbiddenWords: ['Köy', 'Ağa', 'Drama', 'Tarla', 'Anadolu'], hint: 'Çukurovada geçen dönem dizisi', type: 'EXPLAIN' },
    { term: 'Poyraz Karayel', difficulty: 3, forbiddenWords: ['Polis', 'Koruma', 'İstanbul', 'Dizi', 'Aksiyon'], hint: 'Eski polis koruma dizisi', type: 'EXPLAIN' },
    { term: 'Arka Sokaklar', difficulty: 3, forbiddenWords: ['Polis', 'Dizi', 'Karakol', 'Suç', 'Mahalle'], hint: 'Uzun soluklu polis dizisi', type: 'EXPLAIN' },
    { term: 'Sen Anlat Karadeniz', difficulty: 3, forbiddenWords: ['Karadeniz', 'Kadın', 'Drama', 'Dizi', 'Şiddet'], hint: 'Karadenizde geçen drama', type: 'EXPLAIN' },
    { term: 'Hercai', difficulty: 3, forbiddenWords: ['Aşk', 'İntikam', 'Dizi', 'Mardin', 'Konak'], hint: 'Mardinde geçen aşk hikayesi', type: 'EXPLAIN' },
    { term: 'Kuruluş Osman', difficulty: 3, forbiddenWords: ['Osmanlı', 'Ertuğrul', 'Oğul', 'Tarih', 'Kurucu'], hint: 'Diriliş Ertuğrulun devamı', type: 'EXPLAIN' },
    { term: 'G.O.R.A.', difficulty: 3, forbiddenWords: ['Uzay', 'Komedi', 'Film', 'Cem', 'Yıldız'], hint: 'Türk uzay komedisi filmi', type: 'EXPLAIN' },
    { term: 'Ay Lav Yu', difficulty: 3, forbiddenWords: ['Komedi', 'Film', 'Aşk', 'Türk', 'Romantik'], hint: 'Romantik Türk komedisi', type: 'EXPLAIN' },
    { term: 'Kalk Gidelim', difficulty: 3, forbiddenWords: ['Yolculuk', 'Otobüs', 'Dizi', 'Komedi', 'Gezi'], hint: 'Otobüs yolculuğu dizisi', type: 'EXPLAIN' },
    { term: 'Sahne', difficulty: 3, forbiddenWords: ['Tiyatro', 'Gösteri', 'Oyuncu', 'Perde', 'Işık'], hint: 'Oyuncuların oynadığı yer', type: 'DRAW' },

    // Difficulty 4 - Hard
    { term: 'Behzat Ç.', difficulty: 4, forbiddenWords: ['Polis', 'Ankara', 'Dedektif', 'Dizi', 'Suç'], hint: 'Ankarada geçen polis dizisi', type: 'EXPLAIN' },
    { term: 'Leyla ile Mecnun', difficulty: 4, forbiddenWords: ['Komedi', 'Absürt', 'Aşk', 'Dizi', 'Çılgın'], hint: 'Absürt komedi klasiği', type: 'EXPLAIN' },
    { term: 'Avrupa Yakası', difficulty: 4, forbiddenWords: ['İstanbul', 'Sitcom', 'Komedi', 'Aile', 'Zengin'], hint: 'İstanbulda geçen sitcom', type: 'EXPLAIN' },
    { term: 'Yılın Filmi Mükemmel', difficulty: 4, forbiddenWords: ['Oscar', 'Ödül', 'En İyi', 'Sinema', 'Yarışma'], hint: 'Oscar kategorisi', type: 'EXPLAIN' },
    { term: 'Masumiyet', difficulty: 4, forbiddenWords: ['Suçsuz', 'Drama', 'Dizi', 'Gizem', 'Aile'], hint: 'Aile sırları dizisi', type: 'EXPLAIN' },
    { term: 'Sadakatsiz', difficulty: 4, forbiddenWords: ['Aldatma', 'Evlilik', 'Drama', 'Dizi', 'Kadın'], hint: 'Aldatma temalı dizi', type: 'EXPLAIN' },
    { term: 'Camdaki Kız', difficulty: 4, forbiddenWords: ['Psikoloji', 'Kız', 'Dizi', 'Gizem', 'Korku'], hint: 'Psikolojik gerilim dizisi', type: 'EXPLAIN' },
    { term: 'Kuzey Güney', difficulty: 4, forbiddenWords: ['Kardeş', 'Hapishane', 'Aşk', 'Dizi', 'İntikam'], hint: 'İki kardeşin hikayesi', type: 'EXPLAIN' },
    { term: 'Süper Kahraman', difficulty: 4, forbiddenWords: ['Güç', 'Kurtarmak', 'Pelerin', 'Maske', 'Film'], hint: 'Marvel ve DC karakterleri', type: 'PANTOMIME' },
    { term: 'Senaryo Yazarı', difficulty: 4, forbiddenWords: ['Film', 'Yazmak', 'Hikaye', 'Diyalog', 'Script'], hint: 'Film hikayesini yazan kişi', type: 'EXPLAIN' },

    // Difficulty 5 - Very Hard
    { term: 'Bir Başkadır', difficulty: 5, forbiddenWords: ['Netflix', 'Türk', 'Drama', 'Psikoloji', 'Toplum'], hint: 'Netflixin Türk yapımı', type: 'EXPLAIN' },
    { term: 'Ethos', difficulty: 5, forbiddenWords: ['Netflix', 'Türk', 'Ahlak', 'Dizi', 'Drama'], hint: 'Bir Başkadırın İngilizce adı', type: 'EXPLAIN' },
    { term: 'Sarmaşık', difficulty: 5, forbiddenWords: ['Bitki', 'Gemi', 'Film', 'Türk', 'Deniz'], hint: 'Türk deniz filmi', type: 'EXPLAIN' },
    { term: 'Kış Uykusu', difficulty: 5, forbiddenWords: ['Kapadokya', 'Otel', 'Film', 'Nuri Bilge', 'Cannes'], hint: 'Altın Palmiye kazanan Türk filmi', type: 'EXPLAIN' },
    { term: 'Ahlat Ağacı', difficulty: 5, forbiddenWords: ['Ağaç', 'Köy', 'Film', 'Nuri Bilge', 'Yazar'], hint: 'Nuri Bilge Ceylan filmi', type: 'EXPLAIN' },
    { term: 'Babam ve Oğlum', difficulty: 5, forbiddenWords: ['Baba', 'Çocuk', 'Drama', 'Film', 'Türk'], hint: 'Dokunaklı Türk aile filmi', type: 'EXPLAIN' },
    { term: 'Vizontele', difficulty: 5, forbiddenWords: ['Köy', 'Televizyon', 'Film', 'Komedi', 'Doğu'], hint: 'Köye televizyon gelmesi', type: 'EXPLAIN' },
    { term: 'Eşkıya', difficulty: 5, forbiddenWords: ['Haydut', 'Film', 'Şener Şen', 'Dağ', 'Türk'], hint: 'Efsanevi Türk aksiyon filmi', type: 'EXPLAIN' },
    { term: 'Nefes: Vatan Sağolsun', difficulty: 5, forbiddenWords: ['Asker', 'Savaş', 'Dağ', 'Film', 'Türk'], hint: 'Türk askeri filmi', type: 'EXPLAIN' },
    { term: 'Sinematograf', difficulty: 5, forbiddenWords: ['Film', 'Makine', 'Eski', 'Projeksiyon', 'Lumiere'], hint: 'İlk film makinesi', type: 'DRAW' },
];

async function seedTurkishFilmTerms() {
    console.log('🎬 Seeding Turkish Film & Series terms...');

    let total = 0;

    for (const term of TURKISH_FILM_TERMS) {
        await prisma.bingoCard.create({
            data: {
                term: term.term,
                forbiddenWords: JSON.stringify(term.forbiddenWords),
                hint: term.hint,
                difficulty: term.difficulty,
                type: term.type,
                category: 'filme_serien',
                language: 'tr'
            }
        });
        total++;
    }

    console.log(`✅ Inserted ${total} Turkish film/series terms`);
}

seedTurkishFilmTerms()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
