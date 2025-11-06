const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// PLM Credentials - HARDCODED (Postman'den alınan ÇALIŞAN credentials)
const PLM_CONFIG = {
    TENANT: 'HA286TFZ2VY8TRHK_PRD',
    TOKEN_URL: 'https://mingle-sso.eu1.inforcloudsuite.com:443/HA286TFZ2VY8TRHK_PRD/as/token.oauth2',
    CLIENT_ID: 'HA286TFZ2VY8TRHK_PRD~jVqIxgO0vQbUjppuaNrbaQq6vhsxRYiRMZeKKKKu6Ng',
    CLIENT_SECRET: 'fBFip3OjD6Z3RMyuNQYqhTQIv3_UmoYDtdWS-_yIaBTiDlnSqClZyTJVcqvhHeR_-j8MH4ZAAZRru-f5fFOlJA',
    USERNAME: 'HA286TFZ2VY8TRHK_PRD#yfk2b4kDzQNzFltTjZ2it5ZLvTTpoQjBZPkaKKiMeu2iRmmZB-eGdEe3SplaHId7NsLNc7HUcp8IrdWg-fvPmA',
    PASSWORD: '7u8jTdSLsMTIhGZsXC5mvEntzC4nf8NJlmZx5XBj_ble0us9qloSnHZ3WPdeAszX4VEnYL-SaSQs37-pvoTsNg'
};

// Credentials artık hardcoded, kontrol gerek yok

/**
 * PLM Token Alma Fonksiyonu
 */
async function getToken() {
    try {
        console.log('🔑 Token alınıyor...');
        
        // URLSearchParams kullan (StylePackAPI formatı)
        const params = new URLSearchParams();
        params.append('grant_type', 'password');
        params.append('client_id', PLM_CONFIG.CLIENT_ID);
        params.append('client_secret', PLM_CONFIG.CLIENT_SECRET);
        params.append('username', PLM_CONFIG.USERNAME);
        params.append('password', PLM_CONFIG.PASSWORD);
        
        const tokenResponse = await axios.post(
            PLM_CONFIG.TOKEN_URL,
            params.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                }
            }
        );
        
        console.log('✅ Token başarıyla alındı');
        return {
            success: true,
            token: tokenResponse.data.access_token,
            expiresIn: tokenResponse.data.expires_in
        };
        
    } catch (error) {
        console.error('❌ Token alma hatası:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * OpenAI ile doğal dil komutunu structured data'ya çevir
 */
async function parseOrderCommand(styleId, command) {
    try {
        console.log('🤖 OpenAI ile komut parse ediliyor...');
        console.log('   StyleID:', styleId);
        console.log('   Komut:', command);

        const prompt = `
Sen bir PLM (Product Lifecycle Management) sipariş yönetim asistanısın.
Kullanıcıdan aldığın doğal dil komutunu analiz edip structured JSON formatına çevirmen gerekiyor.

GÖREV:
Aşağıdaki komutu analiz et ve JSON formatında çıktı ver.

ÇIKARILACAK BİLGİLER:
1. colorCode: Renk kodu (örn: BYZ, SYH, KRM, BEJ, GRI)
2. quantity: Toplam sipariş adedi (sayı olarak)
3. internetPercent: İnternet kanalına ayrılacak yüzde (0-100 arası sayı)

ÖNEMLİ KURALLAR:
- Renk kodunu büyük harfle yaz
- Quantity'den noktalama işaretlerini temizle (20.000 → 20000)
- İnternet yüzdesini sayı olarak ver (%10 → 10)
- Eğer internet yüzdesi belirtilmemişse 0 kullan
- EĞER KOMUTTA ÇOKLU RENK VARSA, HER BİRİ İÇİN AYRI OBJE OLUŞTUR VE ARRAY DÖN
- Tek renk varsa yine de array içinde döndür
- Sadece JSON çıktısı ver, başka açıklama ekleme

TEK RENK ÖRNEK:
Komut: "BYZ renge 20000 adet sipariş geç %10'u internet kanalına ayrılsın"
Çıktı:
[
    {
        "colorCode": "BYZ",
        "quantity": 20000,
        "internetPercent": 10
    }
]

ÇOKLU RENK ÖRNEK:
Komut: "bej 10000 sadece mağaza, gri 5000 %50 internet"
Çıktı:
[
    {
        "colorCode": "BEJ",
        "quantity": 10000,
        "internetPercent": 0
    },
    {
        "colorCode": "GRI",
        "quantity": 5000,
        "internetPercent": 50
    }
]

ŞİMDİ ŞUNU PARSE ET:
${command}

Sadece JSON array döndür, başka açıklama ekleme.`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Sen bir PLM sipariş parsing asistanısın. Sadece JSON formatında cevap veriyorsun."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.1,
            max_tokens: 200
        });

        // Cevabı al
        let content = response.choices[0].message.content.trim();

        // JSON formatını temizle (markdown varsa)
        if (content.startsWith('```json')) {
            content = content.substring(7);
        }
        if (content.startsWith('```')) {
            content = content.substring(3);
        }
        if (content.endsWith('```')) {
            content = content.substring(0, content.length - 3);
        }
        content = content.trim();

        // JSON'a çevir
        let parsedData = JSON.parse(content);

        // Eğer array değilse array yap
        if (!Array.isArray(parsedData)) {
            parsedData = [parsedData];
        }

        // Her renk için validasyon ve normalize
        const orders = parsedData.map(item => {
            if (!item.colorCode || !item.quantity) {
                throw new Error('Gerekli alanlar eksik: colorCode ve quantity zorunludur');
            }

            // internetPercent default 0
            if (item.internetPercent === undefined || item.internetPercent === null) {
                item.internetPercent = 0;
            }

            return {
                styleId: styleId,
                colorCode: item.colorCode.toUpperCase(),
                quantity: Number(item.quantity),
                internetPercent: Number(item.internetPercent)
            };
        });

        console.log(`✅ ${orders.length} renk başarıyla parse edildi:`, orders);

        return {
            success: true,
            data: orders,
            isMultiColor: orders.length > 1
        };

    } catch (error) {
        console.error('❌ OpenAI parsing hatası:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * PLM'den Style bilgilerini çek (SKU, Colorway, Asortisman)
 */
async function getStyleDetails(styleId, colorCode) {
    try {
        console.log(`\n📊 Style detayları alınıyor...`);
        console.log(`   StyleID: ${styleId}`);
        console.log(`   Color Code: ${colorCode}`);

        // Token al
        const tokenResult = await getToken();
        if (!tokenResult.success) {
            throw new Error(`Token alınamadı: ${tokenResult.error}`);
        }

        const token = tokenResult.token;
        const reqConfig = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Infor-Tenantid': PLM_CONFIG.TENANT,
                'Content-Type': 'application/json'
            }
        };

        // Style SKU ve Colorway detayları
        const SKU_HOST = `https://mingle-ionapi.eu1.inforcloudsuite.com/${PLM_CONFIG.TENANT}/FASHIONPLM/odata2/api/odata2/STYLE?$select=StyleId,StyleCode&$expand=STYLESKU($select=SKUId,SkuCode,MakeSizeId,ColorMasterId;$orderby=SKUId),STYLESIZERANGES($select=SizeRangeId;$expand=StyleSizes($select=SizeId;$expand=Size($select=SizeId,SizeCode,Description)),SizeRange($select=Code,SizeCategoryIds)),StyleColorways($select=StyleId,StyleColorwayId,Code,Name,ColorNumber)&$filter=StyleId eq ${styleId}`;

        console.log('🔍 PLM API çağrısı yapılıyor...');
        const SKUDetail = await axios.get(SKU_HOST, reqConfig);
        const skuDetailPayload = SKUDetail.data?.value;

        if (!skuDetailPayload || skuDetailPayload.length === 0) {
            throw new Error('Style bulunamadı');
        }

        const styleData = skuDetailPayload[0];
        console.log(`✅ Style bulundu: ${styleData.StyleCode}`);

        // Colorway'i bul (colorCode ile eşleştir)
        const colorway = styleData.StyleColorways.find(
            (c) => c.Code?.toUpperCase() === colorCode.toUpperCase() ||
                   c.Name?.toUpperCase() === colorCode.toUpperCase() ||
                   c.ColorNumber?.toUpperCase() === colorCode.toUpperCase()
        );

        if (!colorway) {
            throw new Error(`Renk kodu "${colorCode}" bu style'da bulunamadı. Mevcut renkler: ${styleData.StyleColorways.map(c => c.Code).join(', ')}`);
        }

        console.log(`✅ Colorway bulundu: ${colorway.Code} - ${colorway.Name}`);

        // Asortisman bilgileri
        if (!styleData.StyleSizeRanges || styleData.StyleSizeRanges.length === 0) {
            throw new Error('Size range bulunamadı');
        }

        const sizeRange = styleData.StyleSizeRanges[0];
        const asortiArr = sizeRange.StyleSizes.map((size) => Number(size.Size.Description));
        const asortiSum = asortiArr.reduce((acc, val) => acc + val, 0);

        console.log(`✅ Asortisman: [${asortiArr.join(', ')}] → Toplam: ${asortiSum}`);

        // Bu colorway için SKU'ları filtrele
        const colorwaySKUs = styleData.StyleSku.filter(
            (sku) => sku.ColorMasterId === colorway.StyleColorwayId
        );

        console.log(`✅ ${colorwaySKUs.length} adet SKU bulundu`);

        return {
            success: true,
            data: {
                styleId: styleData.StyleId,
                styleCode: styleData.StyleCode,
                colorway: {
                    id: colorway.StyleColorwayId,
                    code: colorway.Code,
                    name: colorway.Name
                },
                sizeRange: {
                    id: sizeRange.SizeRangeId,
                    asortiArr: asortiArr,
                    asortiSum: asortiSum
                },
                sizes: sizeRange.StyleSizes.map((size, index) => ({
                    sizeId: size.SizeId,
                    sizeCode: size.Size.SizeCode,
                    asortiQuantity: asortiArr[index],
                    sku: colorwaySKUs[index]
                })),
                skus: colorwaySKUs
            }
        };

    } catch (error) {
        console.error('❌ Style detay alma hatası:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Sipariş dağılımını hesapla (StylePackAPI mantığı)
 */
function calculateDistribution(styleDetails, quantity, internetPercent) {
    try {
        console.log('\n🧮 Dağılım hesaplanıyor...');
        console.log(`   Toplam: ${quantity} adet`);
        console.log(`   İnternet: %${internetPercent}`);

        const { sizeRange, sizes } = styleDetails;
        const { asortiArr, asortiSum } = sizeRange;

        // Kanal dağılımı
        const totalStore = quantity - (quantity * internetPercent) / 100;
        const totalInternet = (quantity * internetPercent) / 100;

        console.log(`   Mağaza: ${totalStore} adet`);
        console.log(`   İnternet: ${totalInternet} adet`);

        // Paket sayıları
        const paketStore = Math.floor(totalStore / asortiSum);
        const paketInternet = Math.floor(totalInternet / asortiSum);

        console.log(`   Mağaza paketi: ${paketStore}`);
        console.log(`   İnternet paketi: ${paketInternet}`);

        // Beden bazlı dağılım
        const distribution = sizes.map((size, index) => {
            const asorti = asortiArr[index];
            const storeQ = asorti * paketStore;
            const internetQ = asorti * paketInternet;

            return {
                sizeId: size.sizeId,
                sizeCode: size.sizeCode,
                skuCode: size.sku?.SkuCode || 'N/A',
                asortiQuantity: asorti,
                storeQuantity: storeQ,
                internetQuantity: internetQ,
                totalQuantity: storeQ + internetQ
            };
        });

        // Toplam dağıtılan
        const totalDistributed = distribution.reduce((sum, item) => sum + item.totalQuantity, 0);
        const remaining = quantity - totalDistributed;

        console.log(`✅ Dağılım tamamlandı. Dağıtılan: ${totalDistributed}, Kalan: ${remaining}`);

        return {
            success: true,
            data: {
                // PLM'e sipariş yazmak için gerekli ID'ler
                styleId: styleDetails.styleId,
                styleColorwayId: styleDetails.colorway.id,
                colorwayCode: styleDetails.colorway.code,  // ✅ CODE eklendi
                sizeRangeId: styleDetails.sizeRange.id,
                
                input: {
                    quantity,
                    internetPercent,
                    storePercent: 100 - internetPercent
                },
                channels: {
                    store: {
                        total: totalStore,
                        packets: paketStore,
                        distributed: distribution.reduce((sum, item) => sum + item.storeQuantity, 0)
                    },
                    internet: {
                        total: totalInternet,
                        packets: paketInternet,
                        distributed: distribution.reduce((sum, item) => sum + item.internetQuantity, 0)
                    }
                },
                asortisman: {
                    values: asortiArr,
                    total: asortiSum
                },
                distribution: distribution,
                summary: {
                    totalOrdered: quantity,
                    totalDistributed: totalDistributed,
                    remaining: remaining
                }
            }
        };

    } catch (error) {
        console.error('❌ Dağılım hesaplama hatası:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * TEST ENDPOINT - OpenAI Parsing
 */
app.post('/parse-command', async (req, res) => {
    try {
        console.log('\n' + '='.repeat(60));
        console.log('📨 Parse Command İsteği Alındı');
        console.log('🕐 Timestamp:', new Date().toISOString());
        console.log('📦 Body:', JSON.stringify(req.body, null, 2));
        console.log('='.repeat(60));

        const { styleId, command } = req.body;

        if (!styleId || !command) {
            return res.status(400).json({
                status: 'error',
                message: 'styleId ve command gerekli'
            });
        }

        const result = await parseOrderCommand(styleId, command);

        if (result.success) {
            res.json({
                status: 'success',
                message: `${result.data.length} renk başarıyla parse edildi`,
                isMultiColor: result.isMultiColor,
                data: result.data
            });
        } else {
            res.status(500).json({
                status: 'error',
                message: 'Komut parse edilemedi',
                error: result.error
            });
        }

    } catch (error) {
        console.error('❌ Parse command endpoint hatası:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Parse command endpoint hatası',
            error: error.message
        });
    }
});

/**
 * MAIN ENDPOINT - Tam Akış: Parse + Calculate
 */
app.post('/calculate-order', async (req, res) => {
    try {
        console.log('\n' + '='.repeat(70));
        console.log('🎯 TAM AKIŞ BAŞLADI: Parse → PLM → Calculate');
        console.log('🕐 Timestamp:', new Date().toISOString());
        console.log('📦 Body:', JSON.stringify(req.body, null, 2));
        console.log('='.repeat(70));

        const { styleId, command } = req.body;

        if (!styleId || !command) {
            return res.status(400).json({
                status: 'error',
                message: 'styleId ve command gerekli'
            });
        }

        // ADIM 1: OpenAI ile komutu parse et
        console.log('\n📝 ADIM 1: OpenAI Parsing');
        const parseResult = await parseOrderCommand(styleId, command);

        if (!parseResult.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Komut parse edilemedi',
                error: parseResult.error
            });
        }

        const orders = parseResult.data;
        console.log(`✅ ${orders.length} renk parse edildi`);

        // ADIM 2 & 3: Her renk için PLM'den çek ve hesapla
        const results = [];
        const errors = [];

        for (let i = 0; i < orders.length; i++) {
            const order = orders[i];
            console.log(`\n${'='.repeat(70)}`);
            console.log(`🎨 RENK ${i + 1}/${orders.length}: ${order.colorCode}`);
            console.log(`${'='.repeat(70)}`);

            try {
                // PLM'den style detaylarını çek
                console.log('📊 PLM Style Detayları alınıyor...');
                const styleResult = await getStyleDetails(styleId, order.colorCode);

                if (!styleResult.success) {
                    errors.push({
                        colorCode: order.colorCode,
                        error: styleResult.error
                    });
                    console.log(`❌ ${order.colorCode} için hata: ${styleResult.error}`);
                    continue;
                }

                // Dağılımı hesapla
                console.log('🧮 Dağılım hesaplanıyor...');
                const calcResult = calculateDistribution(
                    styleResult.data,
                    order.quantity,
                    order.internetPercent
                );

                if (!calcResult.success) {
                    errors.push({
                        colorCode: order.colorCode,
                        error: calcResult.error
                    });
                    console.log(`❌ ${order.colorCode} için hesaplama hatası: ${calcResult.error}`);
                    continue;
                }

                results.push({
                    colorCode: order.colorCode,
                    quantity: order.quantity,
                    internetPercent: order.internetPercent,
                    styleInfo: {
                        styleId: styleResult.data.styleId,
                        styleCode: styleResult.data.styleCode,
                        colorway: styleResult.data.colorway
                    },
                    distribution: calcResult.data
                });

                console.log(`✅ ${order.colorCode} tamamlandı`);

            } catch (error) {
                errors.push({
                    colorCode: order.colorCode,
                    error: error.message
                });
                console.log(`❌ ${order.colorCode} işlenirken hata: ${error.message}`);
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log(`✅ TAM AKIŞ TAMAMLANDI! (${results.length} başarılı, ${errors.length} hata)`);
        console.log('='.repeat(70));

        // Final response
        res.json({
            status: results.length > 0 ? 'success' : 'error',
            message: `${results.length} renk başarıyla işlendi${errors.length > 0 ? `, ${errors.length} hata` : ''}`,
            isMultiColor: orders.length > 1,
            data: {
                totalColors: orders.length,
                successfulColors: results.length,
                failedColors: errors.length,
                results: results,
                errors: errors.length > 0 ? errors : undefined
            }
        });

    } catch (error) {
        console.error('❌ Calculate order endpoint hatası:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Calculate order endpoint hatası',
            error: error.message
        });
    }
});

/**
 * Birleştirilmiş PLM Request Payload Oluşturma (Çoklu Renk)
 */
function createCombinedRequestPayload(allDistributions, options = {}) {
    const {
        styleId,
        sizeRangeId,
        supplierId = 38,
        dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        udf2 = "",
        mainContact = ""
    } = options;

    // Ana fieldValues
    const fieldValues = [
        { fieldName: "ObjSupplierId", value: supplierId },
        { fieldName: "CreateId", value: 5 },
        { fieldName: "MainContact", value: mainContact },
        { fieldName: "RequestFor", value: 1 },
        { fieldName: "ModuleId", value: 1 },
        { fieldName: "ObjId", value: styleId },
        { fieldName: "Status", value: 1 },
        { fieldName: "GlReqTypeId", value: 1000 },
        { fieldName: "GlReqSubTypeId", value: 2000 },
        { fieldName: "DueDate", value: dueDate },
        { fieldName: "SizeRangeId", value: sizeRangeId }
    ];

    // SubEntities (Tüm renklerin tüm beden+kanal RequestVal'ları)
    const subEntities = [];
    let requestValIdCounter = -1;

    // Her renk için RequestVal'ları ekle
    allDistributions.forEach(distItem => {
        const distributionData = distItem.distributionData;
        
        distributionData.distribution.forEach(item => {
            // Mağaza için RequestVal (quantity > 0 ise)
            if (item.storeQuantity > 0) {
                const currentId = requestValIdCounter--;
                subEntities.push({
                    Key: currentId,
                    SubEntity: "RequestVal",
                    FieldValues: [
                        { FieldName: "RequestValId", Value: currentId },
                        { FieldName: "ItemCode", Value: item.skuCode },
                        { FieldName: "ModuleColorway", Value: distributionData.styleColorwayId },
                        { FieldName: "Quantity", Value: item.storeQuantity },
                        { FieldName: "UOMId" },
                        { FieldName: "SizeId", Value: item.sizeId },
                        { FieldName: "SizeRangeId", Value: distributionData.sizeRangeId },
                        { FieldName: "Notes", Value: "" },
                        { FieldName: "UDF2", Value: udf2 },
                        { FieldName: "UDF3", Value: "" },
                        { FieldName: "ShipTo", Value: "Mağaza" },
                        { FieldName: "SupplierPurchasePrice", Value: 0 },
                        { FieldName: "UDF1", Value: "" }
                    ],
                    SubEntities: []
                });
            }

            // İnternet için RequestVal (quantity > 0 ise)
            if (item.internetQuantity > 0) {
                const currentId = requestValIdCounter--;
                subEntities.push({
                    Key: currentId,
                    SubEntity: "RequestVal",
                    FieldValues: [
                        { FieldName: "RequestValId", Value: currentId },
                        { FieldName: "ItemCode", Value: item.skuCode },
                        { FieldName: "ModuleColorway", Value: distributionData.styleColorwayId },
                        { FieldName: "Quantity", Value: item.internetQuantity },
                        { FieldName: "UOMId" },
                        { FieldName: "SizeId", Value: item.sizeId },
                        { FieldName: "SizeRangeId", Value: distributionData.sizeRangeId },
                        { FieldName: "Notes", Value: "" },
                        { FieldName: "UDF2", Value: udf2 },
                        { FieldName: "UDF3", Value: "" },
                        { FieldName: "ShipTo", Value: "İnternet" },
                        { FieldName: "SupplierPurchasePrice", Value: 0 },
                        { FieldName: "UDF1", Value: "" }
                    ],
                    SubEntities: []
                });
            }
        });
    });

    return {
        key: "0",
        modifyId: 5,
        userId: 5,
        idGenContextVal: null,
        idGenContextVal2: "[]",
        notificationMessageKey: "CREATED_REQUEST_OVERVIEW",
        rowVersionText: "",
        fieldValues: fieldValues,
        subEntities: subEntities,
        Schema: "FSH2"
    };
}

/**
 * PLM Request Payload Oluşturma (Tek Renk - Geriye Uyumluluk)
 */
function createRequestPayload(distributionData, options = {}) {
    const {
        supplierId = 38,  // ✅ 150 değil, 38!
        dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 gün sonra
        udf2 = "",
        mainContact = ""
    } = options;

    // Ana fieldValues
    const fieldValues = [
        { fieldName: "ObjSupplierId", value: supplierId },
        { fieldName: "CreateId", value: 5 },
        { fieldName: "MainContact", value: mainContact },
        { fieldName: "RequestFor", value: 1 },
        { fieldName: "ModuleId", value: 1 },
        { fieldName: "ObjId", value: distributionData.styleId },
        { fieldName: "Status", value: 1 },
        { fieldName: "GlReqTypeId", value: 1000 },
        { fieldName: "GlReqSubTypeId", value: 2000 },
        { fieldName: "DueDate", value: dueDate },
        { fieldName: "SizeRangeId", value: distributionData.sizeRangeId }
    ];

    // SubEntities (Her beden + kanal için RequestVal)
    const subEntities = [];
    let requestValIdCounter = -1;  // ✅ -1'den başla

    distributionData.distribution.forEach(item => {
        // Mağaza için RequestVal (quantity > 0 ise)
        if (item.storeQuantity > 0) {
            const currentId = requestValIdCounter--;  // ✅ ID'yi yakala
            subEntities.push({
                Key: currentId,  // ✅ Key = RequestValId
                SubEntity: "RequestVal",
                FieldValues: [
                    { FieldName: "RequestValId", Value: currentId },  // ✅ Aynı ID
                    { FieldName: "ItemCode", Value: item.skuCode },
                    { FieldName: "ModuleColorway", Value: distributionData.styleColorwayId },  // ✅ ID gönder (number)
                    { FieldName: "Quantity", Value: item.storeQuantity },
                    { FieldName: "UOMId" },  // ✅ Value yok, SAS_TASIMA gibi
                    { FieldName: "SizeId", Value: item.sizeId },
                    { FieldName: "SizeRangeId", Value: distributionData.sizeRangeId },
                    { FieldName: "Notes", Value: "" },
                    { FieldName: "UDF2", Value: udf2 },
                    { FieldName: "UDF3", Value: "" },
                    { FieldName: "ShipTo", Value: "Mağaza" },
                    { FieldName: "SupplierPurchasePrice", Value: 0 },
                    { FieldName: "UDF1", Value: "" }
                ],
                SubEntities: []
            });
        }

        // İnternet için RequestVal (quantity > 0 ise)
        if (item.internetQuantity > 0) {
            const currentId = requestValIdCounter--;  // ✅ ID'yi yakala
            subEntities.push({
                Key: currentId,  // ✅ Key = RequestValId
                SubEntity: "RequestVal",
                FieldValues: [
                    { FieldName: "RequestValId", Value: currentId },  // ✅ Aynı ID
                    { FieldName: "ItemCode", Value: item.skuCode },
                    { FieldName: "ModuleColorway", Value: distributionData.styleColorwayId },  // ✅ ID gönder (number)
                    { FieldName: "Quantity", Value: item.internetQuantity },
                    { FieldName: "UOMId" },  // ✅ Value yok, SAS_TASIMA gibi
                    { FieldName: "SizeId", Value: item.sizeId },
                    { FieldName: "SizeRangeId", Value: distributionData.sizeRangeId },
                    { FieldName: "Notes", Value: "" },
                    { FieldName: "UDF2", Value: udf2 },
                    { FieldName: "UDF3", Value: "" },
                    { FieldName: "ShipTo", Value: "İnternet" },
                    { FieldName: "SupplierPurchasePrice", Value: 0 },
                    { FieldName: "UDF1", Value: "" }
                ],
                SubEntities: []
            });
        }
    });

    return {
        key: "0",
        modifyId: 5,
        userId: 5,
        idGenContextVal: null,
        idGenContextVal2: "[]",
        notificationMessageKey: "CREATED_REQUEST_OVERVIEW",
        rowVersionText: "",
        fieldValues: fieldValues,
        subEntities: subEntities,
        Schema: "FSH2"
    };
}

/**
 * PLM'e Sipariş Yazma
 */
async function createOrderInPLM(payload) {
    try {
        console.log('💾 PLM\'e sipariş yazılıyor...');
        
        // Token al
        const tokenResult = await getToken();
        if (!tokenResult.success) {
            throw new Error(`Token alınamadı: ${tokenResult.error}`);
        }

        const token = tokenResult.token;
        const PLM_SAVE_URL = `https://mingle-ionapi.eu1.inforcloudsuite.com/${PLM_CONFIG.TENANT}/FASHIONPLM/pdm/api/pdm/request/v2/save`;

        console.log('📤 Payload gönderiliyor...');
        console.log(`   SubEntities count: ${payload.subEntities.length}`);
        console.log('📋 Payload Preview:');
        console.log(JSON.stringify(payload, null, 2));
        
        // Payload'u dosyaya yaz
        const fs = require('fs');
        fs.writeFileSync('last-payload.json', JSON.stringify(payload, null, 2), 'utf-8');
        console.log('💾 Payload saved to last-payload.json');

        const response = await axios.post(
            PLM_SAVE_URL,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Sipariş PLM\'e başarıyla yazıldı!');
        
        return {
            success: true,
            data: response.data
        };

    } catch (error) {
        console.error('❌ PLM sipariş yazma hatası:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        }
        return {
            success: false,
            error: error.message,
            details: error.response?.data
        };
    }
}

/**
 * CREATE ORDER ENDPOINT - TAM AKIŞ: Parse + Calculate + Create in PLM
 */
app.post('/create-order', async (req, res) => {
    try {
        console.log('\n' + '='.repeat(70));
        console.log('🎯 SİPARİŞ OLUŞTURMA: Parse → PLM → Calculate → CREATE');
        console.log('🕐 Timestamp:', new Date().toISOString());
        console.log('📦 Body:', JSON.stringify(req.body, null, 2));
        console.log('='.repeat(70));

        const { styleId, command, supplierId, dueDate, udf2 } = req.body;

        if (!styleId || !command) {
            return res.status(400).json({
                status: 'error',
                message: 'styleId ve command gerekli'
            });
        }

        // ADIM 1: OpenAI ile parse
        console.log('\n📝 ADIM 1: OpenAI Parsing');
        const parseResult = await parseOrderCommand(styleId, command);

        if (!parseResult.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Komut parse edilemedi',
                error: parseResult.error
            });
        }

        const orders = parseResult.data;
        console.log(`✅ ${orders.length} renk parse edildi`);

        // ADIM 2-3: Tüm renklerin dağılımlarını hesapla
        const allDistributions = [];
        const errors = [];
        let commonStyleId = styleId;
        let commonSizeRangeId = null;

        for (let i = 0; i < orders.length; i++) {
            const order = orders[i];
            console.log(`\n${'='.repeat(70)}`);
            console.log(`🎨 RENK ${i + 1}/${orders.length}: ${order.colorCode}`);
            console.log(`${'='.repeat(70)}`);

            try {
                // PLM'den style detaylarını çek
                console.log('📊 PLM Style Detayları...');
                const styleResult = await getStyleDetails(styleId, order.colorCode);

                if (!styleResult.success) {
                    errors.push({
                        colorCode: order.colorCode,
                        error: styleResult.error
                    });
                    continue;
                }

                // Dağılımı hesapla
                console.log('🧮 Dağılım Hesaplama...');
                const calcResult = calculateDistribution(
                    styleResult.data,
                    order.quantity,
                    order.internetPercent
                );

                if (!calcResult.success) {
                    errors.push({
                        colorCode: order.colorCode,
                        error: calcResult.error
                    });
                    continue;
                }

                // İlk rengin SizeRangeId'sini kaydet
                if (commonSizeRangeId === null) {
                    commonSizeRangeId = calcResult.data.sizeRangeId;
                }

                allDistributions.push({
                    colorCode: order.colorCode,
                    quantity: order.quantity,
                    internetPercent: order.internetPercent,
                    distributionData: calcResult.data
                });

                console.log(`✅ ${order.colorCode} hesaplandı`);

            } catch (error) {
                errors.push({
                    colorCode: order.colorCode,
                    error: error.message
                });
            }
        }

        // ADIM 4: Eğer başarılı hesaplama varsa, tek bir Request oluştur
        let results = [];
        if (allDistributions.length > 0) {
            console.log(`\n${'='.repeat(70)}`);
            console.log(`📦 TEK REQUEST OLUŞTURMA: ${allDistributions.length} renk birleştiriliyor`);
            console.log(`${'='.repeat(70)}`);

            try {
                // Tüm renklerin distribution'larını birleştirerek tek payload oluştur
                const combinedPayload = createCombinedRequestPayload(
                    allDistributions,
                    {
                        styleId: commonStyleId,
                        sizeRangeId: commonSizeRangeId,
                        supplierId,
                        dueDate,
                        udf2
                    }
                );

                // PLM'e tek seferde yaz
                console.log('💾 PLM\'e Yazma (Tüm Renkler)...');
                const createResult = await createOrderInPLM(combinedPayload);

                if (createResult.success) {
                    results = allDistributions.map(dist => ({
                        colorCode: dist.colorCode,
                        quantity: dist.quantity,
                        internetPercent: dist.internetPercent,
                        plmResponse: createResult.data
                    }));
                    console.log(`✅ Tüm renkler tek Request'te yazıldı!`);
                } else {
                    // Tüm renkler başarısız
                    allDistributions.forEach(dist => {
                        errors.push({
                            colorCode: dist.colorCode,
                            error: createResult.error
                        });
                    });
                }

            } catch (error) {
                allDistributions.forEach(dist => {
                    errors.push({
                        colorCode: dist.colorCode,
                        error: error.message
                    });
                });
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log(`✅ SİPARİŞ OLUŞTURMA TAMAMLANDI! (${results.length} başarılı, ${errors.length} hata)`);
        console.log('='.repeat(70));

        // Response
        res.json({
            status: results.length > 0 ? 'success' : 'error',
            message: `${results.length} renk için sipariş oluşturuldu${errors.length > 0 ? `, ${errors.length} hata` : ''}`,
            isMultiColor: orders.length > 1,
            data: {
                totalColors: orders.length,
                successfulColors: results.length,
                failedColors: errors.length,
                results: results,
                errors: errors.length > 0 ? errors : undefined
            }
        });

    } catch (error) {
        console.error('❌ Create order endpoint hatası:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Create order endpoint hatası',
            error: error.message
        });
    }
});

/**
 * Health Check Endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'ChatdenPO API',
        version: '1.0.0',
        openai_configured: !!process.env.OPENAI_API_KEY
    });
});

/**
 * Ana Sayfa - API Bilgisi
 */
app.get('/', (req, res) => {
    res.json({
        service: 'ChatdenPO API',
        version: '1.0.0',
        description: 'ChatGPT ile Sipariş Dağılım API - Doğal dil ile PLM sipariş dağılımı',
        endpoints: {
            createOrder: 'POST /create-order - TAM SİPARİŞ: Parse → PLM → Calculate → CREATE (ÖNERİLEN)',
            calculateOrder: 'POST /calculate-order - Hesaplama: Parse → PLM → Calculate (TEST)',
            parseCommand: 'POST /parse-command - Sadece doğal dil parse (TEST)',
            health: 'GET /health - Health check'
        },
        mainExample: {
            url: '/create-order',
            method: 'POST',
            description: 'Doğal dil komutuyla PLM\'de sipariş oluşturma',
            body: {
                styleId: 325,
                command: "bej 10000 mağaza, gri 5000 %50 internet",
                supplierId: 150,
                dueDate: "2024-12-31",
                udf2: "COLLECTION2024"
            }
        },
        calculateExample: {
            url: '/calculate-order',
            method: 'POST',
            description: 'Sadece hesaplama (PLM\'e yazmadan)',
            body: {
                styleId: 325,
                command: "bej rengi için 20000 adet sipariş %10 internet"
            }
        },
        testExample: {
            url: '/parse-command',
            method: 'POST',
            description: 'Sadece OpenAI parsing testi',
            body: {
                styleId: 325,
                command: "BYZ renge 20000 adet sipariş geç %10'u internet kanalına ayrılsın"
            }
        }
    });
});

// Server başlat
app.listen(PORT, () => {
    console.log('\n' + '🎉'.repeat(30));
    console.log('🚀 ChatdenPO API Server Başlatıldı!');
    console.log('='.repeat(60));
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌐 Base URL: http://localhost:${PORT}`);
    console.log('='.repeat(60));
    console.log('📍 Endpoints:');
    console.log(`   🎯 POST   http://localhost:${PORT}/create-order      - TAM SİPARİŞ (OpenAI + PLM + Calculate + CREATE)`);
    console.log(`   📊 POST   http://localhost:${PORT}/calculate-order  - Hesaplama (OpenAI + PLM + Calculate)`);
    console.log(`   🟣 POST   http://localhost:${PORT}/parse-command    - OpenAI Parsing (TEST)`);
    console.log(`   🟡 GET    http://localhost:${PORT}/health           - Health check`);
    console.log(`   ⚪ GET    http://localhost:${PORT}/                 - API info`);
    console.log('='.repeat(60));
    console.log('✨ Server hazır ve komutları bekliyor...\n');
});

