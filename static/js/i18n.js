/**
 * NanoSafe Analyzer — Web Multi-Language Internationalization (i18n) Engine
 * Supported Languages: English (en), Hindi (hi), Telugu (te), Tamil (ta), Spanish (es), French (fr), German (de), Japanese (ja), Arabic (ar)
 */

(function() {
    const SUPPORTED_LANGUAGES = [
        { code: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
        { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
        { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
        { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
        { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
        { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
        { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
        { code: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵' },
        { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇸🇦' }
    ];

    const TRANSLATIONS = {
        en: {
            appName: 'NanoSafe Analyzer',
            appSub: 'Translational Nanomedicine & Cytotoxicity Platform',
            projectTitle: 'Evaluation of the Biocompatibility and Cytotoxicity of ZnO Nanoparticles to Determine Safe Biomedical Usage Levels',
            dashboard: 'Command Center',
            newAnalysis: 'New Experiment',
            batchImport: 'Batch 96-Well Importer',
            history: 'Experiment History',
            compare: 'Multi-Experiment Compare',
            reportArchive: 'Report Archive',
            simulator: 'Dose Simulator (What-If)',
            isoGuide: 'Clinical Standards Hub',
            patients: 'Study Participants',
            samples: 'Biological Samples',
            profile: 'Profile & Preferences',
            security: 'Security & Auth',
            adminConsole: 'Admin Console',
            logout: 'Sign Out',
            researcherProfile: 'Researcher Profile',
            mandatoryInfo: '🔴 Mandatory Information',
            optionalInfo: '⚪ Optional Information',
            saveProfile: 'Save Researcher Profile',
            completeWorkspace: '✨ Complete Profile & Enter Workspace',
            fullName: 'Full Legal Name',
            titleSalutation: 'Title / Salutation',
            institution: 'Institution / Organization',
            researchRole: 'Research Role / Title',
            genderPronouns: 'Gender / Pronouns',
            dateOfBirth: 'Date of Birth / Age',
            primaryEmail: 'Primary Email',
            secondaryEmail: 'Alternative / Secondary Email',
            officeAddress: 'Office / Lab Address',
            cityState: 'City & State',
            country: 'Country',
            preferredLanguage: 'Preferred Language',
            bio: 'Personal Bio / Research Focus',
            uploadPhoto: 'Upload Photo',
            removePhoto: 'Remove Photo',
            cancel: 'Cancel',
            save: 'Save Changes',
            changeLang: 'Language',
            quickSearch: 'Quick search experiments, cell lines, IC50... (Press /)',
            online: 'Online',
            verified: 'Verified Account',
            changePassword: 'Change Password'
        },
        hi: {
            appName: 'नैनोसेफ विश्लेषक',
            appSub: 'ट्रांसलेशनल नैनोमेडिसिन और साइटोटॉक्सिसिटी प्लेटफॉर्म',
            projectTitle: 'सुरक्षित बायोमेडिकल उपयोग स्तर निर्धारित करने के लिए ZnO नैनोकणों की बायोकंपैटिबिलिटी और साइटोटॉक्सिसिटी का मूल्यांकन',
            dashboard: 'कमांड सेंटर',
            newAnalysis: 'नया प्रयोग',
            batchImport: 'बैच 96-वेल आयातक',
            history: 'प्रयोग इतिहास',
            compare: 'बहु-प्रयोग तुलना',
            reportArchive: 'रिपोर्ट पुरालेख',
            simulator: 'डोज़ सिम्युलेटर',
            isoGuide: 'क्लिनिकल मानक हब',
            patients: 'अध्ययन प्रतिभागी (रोगी)',
            samples: 'जैविक नमूने',
            profile: 'प्रोफ़ाइल और प्राथमिकताएं',
            security: 'सुरक्षा और प्रमाणीकरण',
            adminConsole: 'व्यवस्थापक कंसोल',
            logout: 'लॉग आउट',
            researcherProfile: 'शोधकर्ता प्रोफ़ाइल',
            mandatoryInfo: '🔴 अनिवार्य जानकारी',
            optionalInfo: '⚪ वैकल्पिक जानकारी',
            saveProfile: 'शोधकर्ता प्रोफ़ाइल सहेजें',
            completeWorkspace: '✨ प्रोफ़ाइल पूर्ण करें और आगे बढ़ें',
            fullName: 'पूरा कानूनी नाम',
            titleSalutation: 'शीर्षक / अभिवादन',
            institution: 'संस्थान / संगठन',
            researchRole: 'शोध भूमिका / पद',
            genderPronouns: 'लिंग / सर्वनाम',
            dateOfBirth: 'जन्म तिथि / आयु',
            primaryEmail: 'प्राथमिक ईमेल',
            secondaryEmail: 'वैकल्पिक ईमेल',
            officeAddress: 'कार्यालय / लैब का पता',
            cityState: 'शहर और राज्य',
            country: 'देश',
            preferredLanguage: 'पसंदीदा भाषा',
            bio: 'व्यक्तिगत विवरण / अनुसंधान फोकस',
            uploadPhoto: 'फ़ोटो अपलोड करें',
            removePhoto: 'फ़ोटो हटाएं',
            cancel: 'रद्द करें',
            save: 'परिवर्तन सहेजें',
            changeLang: 'भाषा',
            quickSearch: 'प्रयोगों, सेल लाइनों की त्वरित खोज... (/ दबाएं)',
            online: 'सक्रिय',
            verified: 'सत्यापित खाता',
            changePassword: 'पासवर्ड बदलें'
        },
        te: {
            appName: 'నానోసేఫ్ ఎనలైజర్',
            appSub: 'నానోమెడిసిన్ మరియు సైటోటాక్సిసిటీ ప్లాట్‌ఫారమ్',
            projectTitle: 'సురక్షిత బయోమెడికల్ వినియోగ స్థాయిలను నిర్ణయించడానికి ZnO నానోపార్టికల్స్ బయోకంపాటిబిలిటీ మరియు సైటోటాక్సిసిటీ మూల్యాంకనం',
            dashboard: 'కమాండ్ సెంటర్',
            newAnalysis: 'కొత్త ప్రయోగం',
            batchImport: 'బ్యాచ్ 96-వెల్ ఇంపోర్టర్',
            history: 'ప్రయోగ చరిత్ర',
            compare: 'బహుళ ప్రయోగాల పోలిక',
            reportArchive: 'నివేదికల ఆర్కైవ్',
            simulator: 'డోస్ సిమ్యులేటర్',
            isoGuide: 'క్లినికల్ ప్రమాణాల కేంద్రం',
            patients: 'అధ్యయనంలో పాల్గొనేవారు (రోగులు)',
            samples: 'జీవ నమూనాలు',
            profile: 'ప్రొఫైల్ & ప్రాధాన్యతలు',
            security: 'భద్రత & ధృవీకరణ',
            adminConsole: 'అడ్మిన్ కన్సోల్',
            logout: 'లాగ్ అవుట్',
            researcherProfile: 'పరిశోధకుడి ప్రొఫైల్',
            mandatoryInfo: '🔴 తప్పనిసరి సమాచారం',
            optionalInfo: '⚪ ఐచ్ఛిక సమాచారం',
            saveProfile: 'ప్రొఫైల్‌ను సేవ్ చేయండి',
            completeWorkspace: '✨ ప్రొఫైల్ పూర్తి చేసి వర్క్‌స్పేస్‌లోకి వెళ్లండి',
            fullName: 'పూర్తి చట్టపరమైన పేరు',
            titleSalutation: 'శీర్షిక (డాక్టర్ / ప్రొఫెసర్)',
            institution: 'సంస్థ / విశ్వవిద్యాలయం',
            researchRole: 'పరిశోధన పాత్ర / హోదా',
            genderPronouns: 'లింగం',
            dateOfBirth: 'పుట్టిన తేదీ / వయస్సు',
            primaryEmail: 'ప్రధాన ఇమెయిల్',
            secondaryEmail: 'రెండవ ఇమెయిల్',
            officeAddress: 'కార్యాలయం / ల్యాబ్ చిరునామా',
            cityState: 'నగరం మరియు రాష్ట్రం',
            country: 'దేశం',
            preferredLanguage: 'ప్రాధాన్య భాష',
            bio: 'పరిశోధన సారాంశం',
            uploadPhoto: 'ఫోటోను అప్‌లోడ్ చేయండి',
            removePhoto: 'ఫోటోను తొలగించండి',
            cancel: 'రద్దు చేయండి',
            save: 'మార్పులను సేవ్ చేయండి',
            changeLang: 'భాష',
            quickSearch: 'శోధించండి... (/ నొక్కండి)',
            online: 'ఆన్‌లైన్',
            verified: 'ధృవీకరించబడిన ఖాతా',
            changePassword: 'పాస్‌వర్డ్‌ను మార్చండి'
        },
        ta: {
            appName: 'நானோசேஃப் ஆய்வாளர்',
            appSub: 'நானோமெடிசின் & சைட்டோடாக்சிசிட்டி தளம்',
            projectTitle: 'பாதுகாப்பான பயோமெடிக்கல் பயன்பாட்டு அளவை தீர்மானிக்க ZnO நானோ துகள்களின் சைட்டோடாக்சிசிட்டி மதிப்பீடு',
            dashboard: 'கட்டளை மையம்',
            newAnalysis: 'புதிய பரிசோதனை',
            batchImport: 'தொகுதி இறக்குமதியாளர்',
            history: 'பரிசோதனை வரலாறு',
            compare: 'ஒப்பீட்டு பகுப்பாய்வு',
            reportArchive: 'அறிக்கை காப்பகம்',
            simulator: 'டோஸ் சிமுலேட்டர்',
            isoGuide: 'மருத்துவ தரநிலைகள்',
            patients: 'ஆய்வுப் பங்கேற்பாளர்கள் (நோயாளிகள்)',
            samples: 'உயிரியல் மாதிரிகள்',
            profile: 'சுயவிவரம் & விருப்பத்தேர்வுகள்',
            security: 'பாதுகாப்பு & அங்கீகாரம்',
            adminConsole: 'நிர்வாக கன்சோல்',
            logout: 'வெளியேறு',
            researcherProfile: 'ஆராய்ச்சியாளர் சுயவிவரம்',
            mandatoryInfo: '🔴 கட்டாய தகவல்',
            optionalInfo: '⚪ விருப்ப தகவல்',
            saveProfile: 'சுயவிவரத்தைச் சேமிக்கவும்',
            completeWorkspace: '✨ சுயவிவரத்தை முடித்து பணியிடத்தில் நுழையவும்',
            fullName: 'முழு சட்டப் பெயர்',
            titleSalutation: 'தலைப்பு (Dr. / Prof.)',
            institution: 'நிறுவனம் / பல்கலைக்கழகம்',
            researchRole: 'ஆராய்ச்சிப் பங்கு / பதவி',
            genderPronouns: 'பாலினம்',
            dateOfBirth: 'பிறந்த தேதி / வயது',
            primaryEmail: 'முதன்மை மின்னஞ்சல்',
            secondaryEmail: 'மாற்று மின்னஞ்சல்',
            officeAddress: 'அலுவலகம் / ஆய்வக முகவரி',
            cityState: 'நகரம் மற்றும் மாநிலம்',
            country: 'நாடு',
            preferredLanguage: 'விருப்பமான மொழி',
            bio: 'ஆராய்ச்சி சுருக்கம்',
            uploadPhoto: 'புகைப்படத்தைப் பதிவேற்று',
            removePhoto: 'புகைப்படத்தை அகற்று',
            cancel: 'ரத்துசெய்',
            save: 'மாற்றங்களைச் சேமிக்கவும்',
            changeLang: 'மொழி',
            quickSearch: 'விரைவான தேடல்... (/ அழுத்தவும்)',
            online: 'செயலில் உள்ளது',
            verified: 'சரிபார்க்கப்பட்ட கணக்கு',
            changePassword: 'கடவுச்சொல்லை மாற்றவும்'
        },
        es: {
            appName: 'NanoSafe Analyzer',
            appSub: 'Plataforma de Nanomedicina y Citotoxicidad',
            projectTitle: 'Evaluación de la Biocompatibilidad y Citotoxicidad de Nanopartículas de ZnO',
            dashboard: 'Centro de Control',
            newAnalysis: 'Nuevo Experimento',
            batchImport: 'Importador de Placas de 96 Pozos',
            history: 'Historial de Experimentos',
            compare: 'Comparar Experimentos',
            reportArchive: 'Archivo de Informes',
            simulator: 'Simulador de Dosis',
            isoGuide: 'Centro de Normas Clínicas',
            patients: 'Participantes del Estudio',
            samples: 'Muestras Biológicas',
            profile: 'Perfil y Preferencias',
            security: 'Seguridad y Autenticación',
            adminConsole: 'Consola de Administración',
            logout: 'Cerrar Sesión',
            researcherProfile: 'Perfil del Investigador',
            mandatoryInfo: '🔴 Información Obligatoria',
            optionalInfo: '⚪ Información Opcional',
            saveProfile: 'Guardar Perfil',
            completeWorkspace: '✨ Completar Perfil y Entrar al Espacio de Trabajo',
            fullName: 'Nombre Legal Completo',
            titleSalutation: 'Título / Saludo',
            institution: 'Institución / Organización',
            researchRole: 'Rol de Investigación',
            genderPronouns: 'Género / Pronombres',
            dateOfBirth: 'Fecha de Nacimiento / Edad',
            primaryEmail: 'Correo Electrónico Principal',
            secondaryEmail: 'Correo Secundario',
            officeAddress: 'Dirección de Oficina / Laboratorio',
            cityState: 'Ciudad y Estado',
            country: 'País',
            preferredLanguage: 'Idioma Preferido',
            bio: 'Biografía Personal / Enfoque de Investigación',
            uploadPhoto: 'Subir Foto',
            removePhoto: 'Eliminar Foto',
            cancel: 'Cancelar',
            save: 'Guardar Cambios',
            changeLang: 'Idioma',
            quickSearch: 'Búsqueda rápida... (Presione /)',
            online: 'En línea',
            verified: 'Cuenta Verificada',
            changePassword: 'Cambiar Contraseña'
        },
        fr: {
            appName: 'NanoSafe Analyzer',
            appSub: 'Plateforme de Nanomédecine et Cytotoxicité',
            projectTitle: 'Évaluation de la Biocompatibilité et de la Cytotoxicité des Nanoparticules de ZnO',
            dashboard: 'Centre de Contrôle',
            newAnalysis: 'Nouvelle Expérience',
            batchImport: 'Importateur de Plaques 96 Puits',
            history: 'Historique des Expériences',
            compare: 'Comparer les Expériences',
            reportArchive: 'Archives des Rapports',
            simulator: 'Simulateur de Dose',
            isoGuide: 'Normes Cliniques ISO',
            patients: 'Participants à l'Étude',
            samples: 'Échantillons Biologiques',
            profile: 'Profil & Préférences',
            security: 'Sécurité & Authentification',
            adminConsole: 'Console d'Administration',
            logout: 'Déconnexion',
            researcherProfile: 'Profil du Chercheur',
            mandatoryInfo: '🔴 Informations Obligatoires',
            optionalInfo: '⚪ Informations Optionnelles',
            saveProfile: 'Enregistrer le Profil',
            completeWorkspace: '✨ Compléter le Profil & Accéder à l'Espace',
            fullName: 'Nom Légal Complet',
            titleSalutation: 'Titre / Salutation',
            institution: 'Institution / Organisation',
            researchRole: 'Rôle de Recherche',
            genderPronouns: 'Genre / Pronoms',
            dateOfBirth: 'Date de Naissance / Âge',
            primaryEmail: 'Email Principal',
            secondaryEmail: 'Email Secondaire',
            officeAddress: 'Adresse du Bureau / Labo',
            cityState: 'Ville & Région',
            country: 'Pays',
            preferredLanguage: 'Langue Préférée',
            bio: 'Bio / Focus de Recherche',
            uploadPhoto: 'Télécharger Photo',
            removePhoto: 'Supprimer Photo',
            cancel: 'Annuler',
            save: 'Enregistrer les Modifications',
            changeLang: 'Langue',
            quickSearch: 'Recherche rapide... (Appuyez sur /)',
            online: 'En ligne',
            verified: 'Compte Vérifié',
            changePassword: 'Changer le Mot de Passe'
        },
        de: {
            appName: 'NanoSafe Analyzer',
            appSub: 'Plattform für Nanomedizin und Zytotoxizität',
            projectTitle: 'Bewertung der Biokompatibilität und Zytotoxizität von ZnO-Nanopartikeln',
            dashboard: 'Kommandozentrale',
            newAnalysis: 'Neues Experiment',
            batchImport: '96-Well-Batch-Importer',
            history: 'Experimentverlauf',
            compare: 'Experimente Vergleichen',
            reportArchive: 'Berichtsarchiv',
            simulator: 'Dosis-Simulator',
            isoGuide: 'Klinisches Normenzentrum',
            patients: 'Studienteilnehmer',
            samples: 'Biologische Proben',
            profile: 'Profil & Einstellungen',
            security: 'Sicherheit & Auth',
            adminConsole: 'Admin-Konsole',
            logout: 'Abmelden',
            researcherProfile: 'Forscherprofil',
            mandatoryInfo: '🔴 Pflichtangaben',
            optionalInfo: '⚪ Optionale Angaben',
            saveProfile: 'Profil Speichern',
            completeWorkspace: '✨ Profil Vervollständigen & Arbeitsbereich Öffnen',
            fullName: 'Vollständiger Name',
            titleSalutation: 'Titel / Anrede',
            institution: 'Institution / Organisation',
            researchRole: 'Forschungsrolle',
            genderPronouns: 'Geschlecht / Pronomen',
            dateOfBirth: 'Geburtsdatum / Alter',
            primaryEmail: 'Haupt-E-Mail',
            secondaryEmail: 'Zweit-E-Mail',
            officeAddress: 'Büro- / Laboradresse',
            cityState: 'Stadt & Bundesland',
            country: 'Land',
            preferredLanguage: 'Bevorzugte Sprache',
            bio: 'Persönliche Bio / Forschungsschwerpunkt',
            uploadPhoto: 'Foto Hochladen',
            removePhoto: 'Foto Entfernen',
            cancel: 'Abbrechen',
            save: 'Änderungen Speichern',
            changeLang: 'Sprache',
            quickSearch: 'Schnellsuche... (/ drücken)',
            online: 'Online',
            verified: 'Verifiziertes Konto',
            changePassword: 'Passwort Ändern'
        },
        ja: {
            appName: 'NanoSafe アナライザー',
            appSub: 'ナノ医療・細胞毒性評価プラットフォーム',
            projectTitle: '安全な医療応用のための酸化亜鉛ナノ粒子の生体適合性および細胞毒性評価',
            dashboard: 'コマンドセンター',
            newAnalysis: '新規実験',
            batchImport: '96ウェルバッチインポーター',
            history: '実験履歴',
            compare: '実験比較',
            reportArchive: 'レポートアーカイブ',
            simulator: '用量シミュレーター',
            isoGuide: '臨床ISO規格ハブ',
            patients: '研究対象患者',
            samples: '生体サンプル',
            profile: 'プロフィールと設定',
            security: 'セキュリティと認証',
            adminConsole: '管理者コンソール',
            logout: 'ログアウト',
            researcherProfile: '研究者プロフィール',
            mandatoryInfo: '🔴 必須情報',
            optionalInfo: '⚪ 任意情報',
            saveProfile: 'プロフィールを保存',
            completeWorkspace: '✨ プロフィールを保存してワークスペースへ',
            fullName: '氏名（本名）',
            titleSalutation: '敬称 / タイトル',
            institution: '所属機関 / 組織',
            researchRole: '役職 / 肩書',
            genderPronouns: '性別 / 代名詞',
            dateOfBirth: '生年月日 / 年齢',
            primaryEmail: '主要メールアドレス',
            secondaryEmail: '予備メールアドレス',
            officeAddress: '研究室 / オフィス住所',
            cityState: '市区町村・都道府県',
            country: '国',
            preferredLanguage: '優先言語',
            bio: '研究概要 / 自己紹介',
            uploadPhoto: '写真をアップロード',
            removePhoto: '写真を削除',
            cancel: 'キャンセル',
            save: '変更を保存',
            changeLang: '言語',
            quickSearch: 'クイック検索... (/ を押す)',
            online: 'オンライン',
            verified: '認証済みアカウント',
            changePassword: 'パスワード変更'
        },
        ar: {
            appName: 'محلل نانوسيف',
            appSub: 'منصة طب النانو والسمية الخلوية',
            projectTitle: 'تقييم التوافق الحيوي والسمية الخلوية لجسيمات أكسيد الزنك النانوية',
            dashboard: 'مركز القيادة',
            newAnalysis: 'تجربة جديدة',
            batchImport: 'مستورد الدفعات (96-Well)',
            history: 'سجل التجارب',
            compare: 'مقارنة التجارب',
            reportArchive: 'أرشيف التقارير',
            simulator: 'محاكي الجرعات',
            isoGuide: 'مركز معايير ISO السريرية',
            patients: 'المشاركون في الدراسة',
            samples: 'العينات البيولوجية',
            profile: 'الملف الشخصي والتفضيلات',
            security: 'الأمان والمصادقة',
            adminConsole: 'لوحة تحكم المسؤول',
            logout: 'تسجيل الخروج',
            researcherProfile: 'ملف الباحث',
            mandatoryInfo: '🔴 معلومات إلزامية',
            optionalInfo: '⚪ معلومات اختيارية',
            saveProfile: 'حفظ ملف الباحث',
            completeWorkspace: '✨ إكمال الملف الشخصي والدخول لمساحة العمل',
            fullName: 'الاسم القانوني الكامل',
            titleSalutation: 'اللقب / الصفة',
            institution: 'المؤسسة / المنظمة',
            researchRole: 'المسمى الوظيفي / الدور',
            genderPronouns: 'النوع / الضمائر',
            dateOfBirth: 'تاريخ الميلاد / العمر',
            primaryEmail: 'البريد الإلكتروني الرئيسي',
            secondaryEmail: 'البريد الإلكتروني البديل',
            officeAddress: 'عنوان المكتب / المختبر',
            cityState: 'المدينة والمحافظة',
            country: 'الدولة',
            preferredLanguage: 'اللغة المفضلة',
            bio: 'نبذة شخصية / التركيز البحثي',
            uploadPhoto: 'تحميل صورة',
            removePhoto: 'إزالة الصورة',
            cancel: 'إلغاء',
            save: 'حفظ التغييرات',
            changeLang: 'اللغة',
            quickSearch: 'بحث سريع... (اضغط /)',
            online: 'متصل',
            verified: 'حساب موثق',
            changePassword: 'تغيير كلمة المرور'
        }
    };

    const LANG_KEY = 'nanosafe_app_language_code';

    function getCurrentLang() {
        return localStorage.getItem(LANG_KEY) || 'en';
    }

    function setLanguage(langCode) {
        if (TRANSLATIONS[langCode]) {
            localStorage.setItem(LANG_KEY, langCode);
            applyTranslations(langCode);
            updateDropdownLabels(langCode);
        }
    }

    function t(key, fallback = '') {
        const lang = getCurrentLang();
        const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
        if (dict && dict[key] !== undefined) return dict[key];
        if (TRANSLATIONS.en && TRANSLATIONS.en[key] !== undefined) return TRANSLATIONS.en[key];
        return fallback || key;
    }

    function applyTranslations(langCode) {
        const dict = TRANSLATIONS[langCode] || TRANSLATIONS.en;

        // 1. Text elements with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.innerText = dict[key];
            }
        });

        // 2. Placeholders with data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (dict[key]) {
                el.setAttribute('placeholder', dict[key]);
            }
        });

        // 3. Document direction for RTL languages like Arabic
        if (langCode === 'ar') {
            document.documentElement.setAttribute('dir', 'rtl');
        } else {
            document.documentElement.setAttribute('dir', 'ltr');
        }
    }

    function updateDropdownLabels(langCode) {
        const activeLangObj = SUPPORTED_LANGUAGES.find(l => l.code === langCode) || SUPPORTED_LANGUAGES[0];
        const topbarBtn = document.getElementById('topbarLangBtnText');
        if (topbarBtn) {
            topbarBtn.innerText = `${activeLangObj.flag} ${activeLangObj.code.toUpperCase()}`;
        }
        const sidebarBtn = document.getElementById('sidebarLangText');
        if (sidebarBtn) {
            sidebarBtn.innerText = `${activeLangObj.flag} ${activeLangObj.native}`;
        }
    }

    // Expose global methods
    window.NanoSafe_i18n = {
        languages: SUPPORTED_LANGUAGES,
        getCurrentLang,
        setLanguage,
        t,
        applyTranslations
    };

    window.t = t;
    window.changeLanguage = setLanguage;

    // Auto-initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        const initialLang = getCurrentLang();
        applyTranslations(initialLang);
        updateDropdownLabels(initialLang);
    });
})();
