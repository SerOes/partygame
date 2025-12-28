import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Turkish Music terms with difficulty levels
const TURKISH_MUSIC_TERMS = {
    de: [
        // Difficulty 1 - Very Easy (everyone knows)
        { term: 'Tarkan', difficulty: 1, forbiddenWords: ['Sänger', 'Türkei', 'Kiss Kiss', 'Pop', 'Star'], hint: 'Meistbekannter türkischer Popstar weltweit', type: 'EXPLAIN' },
        { term: 'Darbuka', difficulty: 1, forbiddenWords: ['Trommel', 'Schlagen', 'Rhythmus', 'Hand', 'Musik'], hint: 'Traditionelle Bechertrommel', type: 'PANTOMIME' },
        { term: 'Tanzen', difficulty: 1, forbiddenWords: ['Musik', 'Bewegen', 'Disco', 'Party', 'Beine'], hint: 'Was macht man bei türkischer Musik?', type: 'PANTOMIME' },
        { term: 'Saz', difficulty: 1, forbiddenWords: ['Gitarre', 'Saiten', 'Instrument', 'Türkisch', 'Spielen'], hint: 'Langhalslaute aus Anatolien', type: 'DRAW' },
        { term: 'Mikrofon', difficulty: 1, forbiddenWords: ['Singen', 'Sprechen', 'Laut', 'Bühne', 'Stimme'], hint: 'Was hält ein Sänger in der Hand?', type: 'DRAW' },
        { term: 'Hochzeitsmusik', difficulty: 1, forbiddenWords: ['Heiraten', 'Feier', 'Braut', 'Party', 'Tanz'], hint: 'Davul und Zurna bei einer Zeremonie', type: 'EXPLAIN' },
        { term: 'Singen', difficulty: 1, forbiddenWords: ['Stimme', 'Lied', 'Musik', 'Töne', 'Mikrofon'], hint: 'Was macht Tarkan beruflich?', type: 'PANTOMIME' },
        { term: 'Klarinette', difficulty: 1, forbiddenWords: ['Blasen', 'Holz', 'Instrument', 'Musik', 'Schwarz'], hint: 'Typisches Instrument in türkischer Volksmusik', type: 'DRAW' },
        { term: 'Konzert', difficulty: 1, forbiddenWords: ['Bühne', 'Musik', 'Live', 'Sänger', 'Publikum'], hint: 'Wo sieht man Stars live?', type: 'EXPLAIN' },
        { term: 'Halay', difficulty: 1, forbiddenWords: ['Tanzen', 'Gruppe', 'Hand', 'Kreis', 'Türkisch'], hint: 'Traditioneller Gruppentanz in Reihe', type: 'PANTOMIME' },

        // Difficulty 2 - Easy
        { term: 'Sezen Aksu', difficulty: 2, forbiddenWords: ['Sängerin', 'Königin', 'Pop', 'Türkei', 'Diva'], hint: 'Die Königin der türkischen Popmusik', type: 'EXPLAIN' },
        { term: 'Arabesk', difficulty: 2, forbiddenWords: ['Musik', 'Traurig', 'Türkisch', 'Genre', 'Melancholisch'], hint: 'Melancholisches türkisches Musikgenre', type: 'EXPLAIN' },
        { term: 'Davul', difficulty: 2, forbiddenWords: ['Trommel', 'Groß', 'Schlagen', 'Laut', 'Hochzeit'], hint: 'Große Trommel bei Hochzeiten', type: 'DRAW' },
        { term: 'Zurna', difficulty: 2, forbiddenWords: ['Blasen', 'Laut', 'Hochzeit', 'Schrill', 'Holz'], hint: 'Schrille Oboe bei türkischen Festen', type: 'EXPLAIN' },
        { term: 'Müslüm Gürses', difficulty: 2, forbiddenWords: ['Sänger', 'Arabesk', 'Baba', 'Türkei', 'Traurig'], hint: 'Der Arabesk-Baba', type: 'EXPLAIN' },
        { term: 'Türkü', difficulty: 2, forbiddenWords: ['Volkslied', 'Tradition', 'Anatolien', 'Singen', 'Alt'], hint: 'Anatolisches Volkslied', type: 'EXPLAIN' },
        { term: 'Zeybek', difficulty: 2, forbiddenWords: ['Tanz', 'Ägäis', 'Langsam', 'Mann', 'Krieger'], hint: 'Heldentanz aus der Ägäis-Region', type: 'PANTOMIME' },
        { term: 'Bağlama', difficulty: 2, forbiddenWords: ['Saz', 'Instrument', 'Saiten', 'Türkisch', 'Spielen'], hint: 'Anderer Name für Saz', type: 'DRAW' },
        { term: 'İbrahim Tatlıses', difficulty: 2, forbiddenWords: ['Sänger', 'İmparator', 'Kurde', 'Arabesk', 'Stimme'], hint: 'Der İmparator der türkischen Musik', type: 'EXPLAIN' },
        { term: 'Karaoke', difficulty: 2, forbiddenWords: ['Singen', 'Text', 'Bar', 'Mikrofon', 'Bildschirm'], hint: 'Selbst singen zu Musikvideos', type: 'PANTOMIME' },

        // Difficulty 3 - Medium
        { term: 'Şebnem Ferah', difficulty: 3, forbiddenWords: ['Rock', 'Sängerin', 'Gitarre', 'Türkei', 'Hard'], hint: 'Königin des türkischen Rock', type: 'EXPLAIN' },
        { term: 'Ajda Pekkan', difficulty: 3, forbiddenWords: ['Süperstar', 'Diva', 'Pop', 'Blond', '70er'], hint: 'Die türkische Süperstar seit den 70ern', type: 'EXPLAIN' },
        { term: 'Barış Manço', difficulty: 3, forbiddenWords: ['Sänger', 'Schnurrbart', 'Anadolu', 'Rock', 'Kinder'], hint: 'Legendärer Anadolu-Rock Pionier', type: 'EXPLAIN' },
        { term: 'MFÖ', difficulty: 3, forbiddenWords: ['Band', 'Drei', 'Pop', 'Rock', 'Gruppe'], hint: 'Beliebte türkische Pop-Rock Band mit 3 Buchstaben', type: 'EXPLAIN' },
        { term: 'Cem Karaca', difficulty: 3, forbiddenWords: ['Rock', 'Anadolu', 'Sänger', 'Protest', 'Legende'], hint: 'Anadolu Rock Legende mit politischen Songs', type: 'EXPLAIN' },
        { term: 'Duman', difficulty: 3, forbiddenWords: ['Band', 'Rock', 'Rauch', 'Türkei', 'Sari'], hint: 'Beliebte türkische Rockband (Name bedeutet Rauch)', type: 'EXPLAIN' },
        { term: 'Aleyna Tilki', difficulty: 3, forbiddenWords: ['Jung', 'Pop', 'Sängerin', 'Cevapsız', 'Fuchs'], hint: 'Junge türkische Popsängerin (Name bedeutet Fuchs)', type: 'EXPLAIN' },
        { term: 'Mor ve Ötesi', difficulty: 3, forbiddenWords: ['Band', 'Rock', 'Eurovision', 'Lila', 'Türkei'], hint: 'Türkische Rockband, Eurovision 2008', type: 'EXPLAIN' },
        { term: 'Ney', difficulty: 3, forbiddenWords: ['Flöte', 'Sufi', 'Blasen', 'Rohr', 'Mystisch'], hint: 'Mystische Rohrflöte der Sufis', type: 'DRAW' },
        { term: 'Horon', difficulty: 3, forbiddenWords: ['Tanz', 'Schwarzes Meer', 'Schnell', 'Gruppe', 'Tremolo'], hint: 'Schneller Gruppentanz vom Schwarzen Meer', type: 'PANTOMIME' },

        // Difficulty 4 - Hard
        { term: 'Erkin Koray', difficulty: 4, forbiddenWords: ['Rock', 'Psychedelic', 'Gitarre', 'Pionier', 'Anadolu'], hint: 'Pionier des türkischen Psychedelic Rock', type: 'EXPLAIN' },
        { term: 'Selda Bağcan', difficulty: 4, forbiddenWords: ['Sängerin', 'Folk', 'Protest', 'Politisch', 'Gefängnis'], hint: 'Folk-Sängerin, bekannt für Protestlieder', type: 'EXPLAIN' },
        { term: 'Zeki Müren', difficulty: 4, forbiddenWords: ['Sänger', 'Klassisch', 'Bühne', 'Kostüm', 'Kunst'], hint: 'Der Sonnengott der türkischen Klassik', type: 'EXPLAIN' },
        { term: 'Fasıl', difficulty: 4, forbiddenWords: ['Klassisch', 'Osmanisch', 'Ensemble', 'Traditionell', 'Suite'], hint: 'Klassische osmanische Musikform', type: 'EXPLAIN' },
        { term: 'Kemençe', difficulty: 4, forbiddenWords: ['Geige', 'Streich', 'Schwarzes Meer', 'Klein', 'Bogen'], hint: 'Kleine Kniegeige vom Schwarzen Meer', type: 'DRAW' },
        { term: 'Tulum', difficulty: 4, forbiddenWords: ['Dudelsack', 'Schwarzes Meer', 'Blasen', 'Beutel', 'Schaf'], hint: 'Türkischer Dudelsack aus Ziegenfell', type: 'DRAW' },
        { term: 'Maqam', difficulty: 4, forbiddenWords: ['Tonleiter', 'Arabisch', 'Melodie', 'System', 'Modus'], hint: 'Melodisches Modalsystem in türkischer Musik', type: 'EXPLAIN' },
        { term: 'Orhan Gencebay', difficulty: 4, forbiddenWords: ['Sänger', 'Arabesk', 'Bağlama', 'Pionier', 'Traurig'], hint: 'Gründer des modernen Arabesk', type: 'EXPLAIN' },
        { term: 'Neşet Ertaş', difficulty: 4, forbiddenWords: ['Bağlama', 'Aşık', 'Volkssänger', 'Bozkır', 'Meister'], hint: 'Legendärer Bağlama-Meister und Volkssänger', type: 'EXPLAIN' },
        { term: 'Kayahan', difficulty: 4, forbiddenWords: ['Sänger', 'Songwriter', 'Romantisch', 'Pop', 'Gedichte'], hint: 'Romantischer türkischer Singer-Songwriter', type: 'EXPLAIN' },

        // Difficulty 5 - Very Hard
        { term: 'Usul', difficulty: 5, forbiddenWords: ['Rhythmus', 'Muster', 'Klassisch', 'Zyklus', 'Beat'], hint: 'Rhythmische Zyklen in klassischer türkischer Musik', type: 'EXPLAIN' },
        { term: 'Aşık Veysel', difficulty: 5, forbiddenWords: ['Blind', 'Dichter', 'Saz', 'Volkssänger', 'Sivas'], hint: 'Blinder legendärer Volkssänger aus Sivas', type: 'EXPLAIN' },
        { term: 'Münir Nurettin Selçuk', difficulty: 5, forbiddenWords: ['Klassisch', 'Sänger', 'Osmanisch', 'Meister', 'Stimme'], hint: 'Meister des klassischen türkischen Gesangs', type: 'EXPLAIN' },
        { term: 'Sufi-Wirbeltanz', difficulty: 5, forbiddenWords: ['Drehen', 'Mevlevi', 'Mystik', 'Weißes Kleid', 'Konya'], hint: 'Mystischer Drehtanz der Mevlevi-Orden', type: 'PANTOMIME' },
        { term: 'Kanun', difficulty: 5, forbiddenWords: ['Zither', 'Saiten', 'Klassisch', 'Trapez', 'Zupfen'], hint: 'Trapezförmige Zither der klassischen Musik', type: 'DRAW' },
        { term: 'Ud', difficulty: 5, forbiddenWords: ['Laute', 'Arabisch', 'Saiten', 'Birnenform', 'Zupfen'], hint: 'Birnenförmige Kurzhalslaute', type: 'DRAW' },
        { term: 'Bülent Ortaçgil', difficulty: 5, forbiddenWords: ['Singer', 'Songwriter', 'Poet', 'Akustik', 'Kult'], hint: 'Kultiger türkischer Singer-Songwriter-Poet', type: 'EXPLAIN' },
        { term: 'Sertab Erener', difficulty: 5, forbiddenWords: ['Eurovision', 'Winner', '2003', 'Everyway', 'Pop'], hint: 'Gewann Eurovision 2003 für die Türkei', type: 'EXPLAIN' },
        { term: 'Bendir', difficulty: 5, forbiddenWords: ['Trommel', 'Rahmen', 'Sufi', 'Hand', 'Rund'], hint: 'Rahmentrommel für Sufi-Rituale', type: 'DRAW' },
        { term: 'Gazino', difficulty: 5, forbiddenWords: ['Nachtclub', 'Musik', 'Essen', 'Show', 'Türkisch'], hint: 'Traditioneller türkischer Musiknachtclub', type: 'EXPLAIN' },
    ],
    tr: [
        // Difficulty 1 - Very Easy
        { term: 'Tarkan', difficulty: 1, forbiddenWords: ['Şarkıcı', 'Pop', 'Megastar', 'Şımarık', 'Türk'], hint: 'Dünyanın en ünlü Türk pop yıldızı', type: 'EXPLAIN' },
        { term: 'Darbuka', difficulty: 1, forbiddenWords: ['Davul', 'Vurmak', 'Ritim', 'El', 'Müzik'], hint: 'Geleneksel kadeh şeklinde vurmalı', type: 'PANTOMIME' },
        { term: 'Dans etmek', difficulty: 1, forbiddenWords: ['Müzik', 'Hareket', 'Parti', 'Ayak', 'Eğlence'], hint: 'Düğünlerde ne yapılır?', type: 'PANTOMIME' },
        { term: 'Saz', difficulty: 1, forbiddenWords: ['Bağlama', 'Telli', 'Enstrüman', 'Çalmak', 'Anadolu'], hint: 'Anadolunun simgesi olan telli çalgı', type: 'DRAW' },
        { term: 'Mikrofon', difficulty: 1, forbiddenWords: ['Şarkı', 'Ses', 'Sahne', 'Konuşmak', 'Tutmak'], hint: 'Şarkıcılar ne tutar?', type: 'DRAW' },
        { term: 'Düğün müziği', difficulty: 1, forbiddenWords: ['Evlilik', 'Gelin', 'Damat', 'Halay', 'Davul'], hint: 'Davul zurna ile yapılan kutlama', type: 'EXPLAIN' },
        { term: 'Şarkı söylemek', difficulty: 1, forbiddenWords: ['Ses', 'Müzik', 'Nota', 'Mikrofon', 'Melodi'], hint: 'Tarkanın mesleği', type: 'PANTOMIME' },
        { term: 'Klarnet', difficulty: 1, forbiddenWords: ['Üflemek', 'Tahta', 'Enstrüman', 'Müzik', 'Siyah'], hint: 'Türk halk müziğinde sık kullanılan nefesli', type: 'DRAW' },
        { term: 'Konser', difficulty: 1, forbiddenWords: ['Sahne', 'Müzik', 'Canlı', 'Şarkıcı', 'Seyirci'], hint: 'Yıldızları canlı nerede görürsün?', type: 'EXPLAIN' },
        { term: 'Halay', difficulty: 1, forbiddenWords: ['Dans', 'Grup', 'El', 'Sıra', 'Düğün'], hint: 'Geleneksel sıra dansı', type: 'PANTOMIME' },

        // Difficulty 2 - Easy
        { term: 'Sezen Aksu', difficulty: 2, forbiddenWords: ['Şarkıcı', 'Kraliçe', 'Pop', 'Diva', 'Türk'], hint: 'Türk popunun kraliçesi', type: 'EXPLAIN' },
        { term: 'Arabesk', difficulty: 2, forbiddenWords: ['Müzik', 'Hüzünlü', 'Türk', 'Tür', 'Acı'], hint: 'Melankoli dolu Türk müzik türü', type: 'EXPLAIN' },
        { term: 'Davul', difficulty: 2, forbiddenWords: ['Büyük', 'Vurmak', 'Düğün', 'Ses', 'Ritim'], hint: 'Düğünlerde çalınan büyük vurmalı', type: 'DRAW' },
        { term: 'Zurna', difficulty: 2, forbiddenWords: ['Üflemek', 'Yüksek ses', 'Düğün', 'Tiz', 'Davul'], hint: 'Davulun yanında çalınan tiz nefesli', type: 'EXPLAIN' },
        { term: 'Müslüm Gürses', difficulty: 2, forbiddenWords: ['Şarkıcı', 'Arabesk', 'Baba', 'Efsane', 'Hüzün'], hint: 'Arabesk müziğin babası', type: 'EXPLAIN' },
        { term: 'Türkü', difficulty: 2, forbiddenWords: ['Halk şarkısı', 'Gelenek', 'Anadolu', 'Anonim', 'Köy'], hint: 'Anadolu halk şarkısı', type: 'EXPLAIN' },
        { term: 'Zeybek', difficulty: 2, forbiddenWords: ['Dans', 'Ege', 'Yavaş', 'Erkek', 'Kahraman'], hint: 'Ege bölgesinin kahraman dansı', type: 'PANTOMIME' },
        { term: 'Bağlama', difficulty: 2, forbiddenWords: ['Saz', 'Telli', 'Çalmak', 'Anadolu', 'Enstrüman'], hint: 'Sazın diğer adı', type: 'DRAW' },
        { term: 'İbrahim Tatlıses', difficulty: 2, forbiddenWords: ['Şarkıcı', 'İmparator', 'Ses', 'Arabesk', 'Urfa'], hint: 'Türk müziğinin imparatoru', type: 'EXPLAIN' },
        { term: 'Karaoke', difficulty: 2, forbiddenWords: ['Şarkı', 'Söylemek', 'Yazı', 'Mikrofon', 'Bar'], hint: 'Müzik videosuyla kendin söylemek', type: 'PANTOMIME' },

        // Difficulty 3 - Medium
        { term: 'Şebnem Ferah', difficulty: 3, forbiddenWords: ['Rock', 'Kadın', 'Gitar', 'Kraliçe', 'Hard'], hint: 'Türk rockın kraliçesi', type: 'EXPLAIN' },
        { term: 'Ajda Pekkan', difficulty: 3, forbiddenWords: ['Süperstar', 'Pop', 'Sarışın', '70ler', 'Diva'], hint: '70lerden beri Türk süperstarı', type: 'EXPLAIN' },
        { term: 'Barış Manço', difficulty: 3, forbiddenWords: ['Şarkıcı', 'Bıyık', 'Anadolu', 'Rock', 'Çocuk'], hint: 'Efsanevi Anadolu rock öncüsü', type: 'EXPLAIN' },
        { term: 'MFÖ', difficulty: 3, forbiddenWords: ['Grup', 'Üç', 'Pop', 'Rock', 'Bant'], hint: '3 harfli popüler Türk pop-rock grubu', type: 'EXPLAIN' },
        { term: 'Cem Karaca', difficulty: 3, forbiddenWords: ['Rock', 'Anadolu', 'Protesto', 'Efsane', 'Politik'], hint: 'Anadolu rock efsanesi, politik şarkılar', type: 'EXPLAIN' },
        { term: 'Duman', difficulty: 3, forbiddenWords: ['Grup', 'Rock', 'Sigara', 'Türk', 'Kaan'], hint: 'Popüler Türk rock grubu', type: 'EXPLAIN' },
        { term: 'Aleyna Tilki', difficulty: 3, forbiddenWords: ['Genç', 'Pop', 'Şarkıcı', 'Cevapsız', 'Hayvan'], hint: 'Popüler genç Türk pop şarkıcısı', type: 'EXPLAIN' },
        { term: 'Mor ve Ötesi', difficulty: 3, forbiddenWords: ['Grup', 'Rock', 'Eurovision', 'Mor', 'Türk'], hint: 'Eurovision 2008e katılan Türk rock grubu', type: 'EXPLAIN' },
        { term: 'Ney', difficulty: 3, forbiddenWords: ['Flüt', 'Sufi', 'Üflemek', 'Kamış', 'Mistik'], hint: 'Sufilerin mistik kamış flütü', type: 'DRAW' },
        { term: 'Horon', difficulty: 3, forbiddenWords: ['Dans', 'Karadeniz', 'Hızlı', 'Grup', 'Titreme'], hint: 'Karadenizin hızlı grup dansı', type: 'PANTOMIME' },

        // Difficulty 4 - Hard
        { term: 'Erkin Koray', difficulty: 4, forbiddenWords: ['Rock', 'Psychedelic', 'Gitar', 'Öncü', 'Anadolu'], hint: 'Türk psychedelic rockın öncüsü', type: 'EXPLAIN' },
        { term: 'Selda Bağcan', difficulty: 4, forbiddenWords: ['Şarkıcı', 'Folk', 'Protesto', 'Politik', 'Cezaevi'], hint: 'Protesto şarkılarıyla tanınan folk şarkıcısı', type: 'EXPLAIN' },
        { term: 'Zeki Müren', difficulty: 4, forbiddenWords: ['Şarkıcı', 'Klasik', 'Sahne', 'Kostüm', 'Sanat'], hint: 'Türk klasik müziğin güneşi', type: 'EXPLAIN' },
        { term: 'Fasıl', difficulty: 4, forbiddenWords: ['Klasik', 'Osmanlı', 'Topluluk', 'Geleneksel', 'Suite'], hint: 'Klasik Osmanlı müzik formu', type: 'EXPLAIN' },
        { term: 'Kemençe', difficulty: 4, forbiddenWords: ['Keman', 'Yaylı', 'Karadeniz', 'Küçük', 'Diz'], hint: 'Karadenizin küçük diz kemanı', type: 'DRAW' },
        { term: 'Tulum', difficulty: 4, forbiddenWords: ['Gayda', 'Karadeniz', 'Üflemek', 'Torba', 'Keçi'], hint: 'Keçi derisinden Türk gaydası', type: 'DRAW' },
        { term: 'Makam', difficulty: 4, forbiddenWords: ['Dizi', 'Melodi', 'Sistem', 'Mod', 'Türk'], hint: 'Türk müziğinde melodik mod sistemi', type: 'EXPLAIN' },
        { term: 'Orhan Gencebay', difficulty: 4, forbiddenWords: ['Şarkıcı', 'Arabesk', 'Bağlama', 'Öncü', 'Hüzün'], hint: 'Modern arabeskin kurucusu', type: 'EXPLAIN' },
        { term: 'Neşet Ertaş', difficulty: 4, forbiddenWords: ['Bağlama', 'Aşık', 'Halk', 'Bozkır', 'Usta'], hint: 'Efsanevi bağlama ustası ve halk ozanı', type: 'EXPLAIN' },
        { term: 'Kayahan', difficulty: 4, forbiddenWords: ['Şarkıcı', 'Söz yazarı', 'Romantik', 'Pop', 'Şiir'], hint: 'Romantik Türk şarkıcı ve söz yazarı', type: 'EXPLAIN' },

        // Difficulty 5 - Very Hard
        { term: 'Usul', difficulty: 5, forbiddenWords: ['Ritim', 'Kalıp', 'Klasik', 'Döngü', 'Vuruş'], hint: 'Klasik Türk müziğinde ritmik döngüler', type: 'EXPLAIN' },
        { term: 'Aşık Veysel', difficulty: 5, forbiddenWords: ['Kör', 'Ozan', 'Saz', 'Halk', 'Sivas'], hint: 'Sivaslı efsanevi kör halk ozanı', type: 'EXPLAIN' },
        { term: 'Münir Nurettin Selçuk', difficulty: 5, forbiddenWords: ['Klasik', 'Şarkıcı', 'Osmanlı', 'Usta', 'Ses'], hint: 'Klasik Türk müziği icrasının ustası', type: 'EXPLAIN' },
        { term: 'Sema', difficulty: 5, forbiddenWords: ['Dönmek', 'Mevlevi', 'Mistik', 'Beyaz', 'Konya'], hint: 'Mevlevi dervişlerinin mistik dönüş dansı', type: 'PANTOMIME' },
        { term: 'Kanun', difficulty: 5, forbiddenWords: ['Santur', 'Telli', 'Klasik', 'Yamuk', 'Parmak'], hint: 'Klasik müziğin trapez şeklindeki çalgısı', type: 'DRAW' },
        { term: 'Ud', difficulty: 5, forbiddenWords: ['Lavta', 'Telli', 'Armut', 'Arap', 'Kısa sap'], hint: 'Armut şeklindeki kısa saplı telli çalgı', type: 'DRAW' },
        { term: 'Bülent Ortaçgil', difficulty: 5, forbiddenWords: ['Şarkıcı', 'Söz yazarı', 'Şair', 'Akustik', 'Kült'], hint: 'Kült Türk şarkıcı-söz yazarı ve şairi', type: 'EXPLAIN' },
        { term: 'Sertab Erener', difficulty: 5, forbiddenWords: ['Eurovision', 'Kazanan', '2003', 'Everyway', 'Pop'], hint: '2003te Türkiye için Eurovisioni kazandı', type: 'EXPLAIN' },
        { term: 'Bendir', difficulty: 5, forbiddenWords: ['Davul', 'Çerçeve', 'Sufi', 'El', 'Yuvarlak'], hint: 'Sufi ritüellerinde kullanılan çerçeve davulu', type: 'DRAW' },
        { term: 'Gazino', difficulty: 5, forbiddenWords: ['Gece kulübü', 'Müzik', 'Yemek', 'Şov', 'Eğlence'], hint: 'Geleneksel Türk müzikli gece kulübü', type: 'EXPLAIN' },
    ]
};

async function seedTurkishMusicTerms() {
    console.log('🎵 Seeding Turkish Music terms...');

    let totalDE = 0;
    let totalTR = 0;

    // Insert German terms
    for (const term of TURKISH_MUSIC_TERMS.de) {
        await prisma.bingoCard.create({
            data: {
                term: term.term,
                forbiddenWords: JSON.stringify(term.forbiddenWords),
                hint: term.hint,
                difficulty: term.difficulty,
                type: term.type,
                category: 'musik_hits',
                language: 'de'
            }
        });
        totalDE++;
    }
    console.log(`✅ Inserted ${totalDE} German music terms`);

    // Insert Turkish terms
    for (const term of TURKISH_MUSIC_TERMS.tr) {
        await prisma.bingoCard.create({
            data: {
                term: term.term,
                forbiddenWords: JSON.stringify(term.forbiddenWords),
                hint: term.hint,
                difficulty: term.difficulty,
                type: term.type,
                category: 'musik_hits',
                language: 'tr'
            }
        });
        totalTR++;
    }
    console.log(`✅ Inserted ${totalTR} Turkish music terms`);

    console.log(`🎉 Total: ${totalDE + totalTR} Turkish music terms added!`);
}

seedTurkishMusicTerms()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
