/**
 * ChatdenPO API Test Script
 * OpenAI Parsing testi
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5000';

// Test senaryoları
const testCases = [
    {
        name: 'Test 1: Tam formatı komut',
        styleId: 325,
        command: "BYZ renge 20000 adet sipariş geç %10'u internet kanalına ayrılsın"
    },
    {
        name: 'Test 2: Kısa format',
        styleId: 330,
        command: "SYH renk 5.000 adet, internet %15"
    },
    {
        name: 'Test 3: Sadece mağaza',
        styleId: 340,
        command: "KRM 3000 adet sadece mağaza"
    },
    {
        name: 'Test 4: Türkçe ifade',
        styleId: 350,
        command: "Lacivert renge 8000 adet sipariş ver, yüzde 20si internet"
    },
    {
        name: 'Test 5: Noktalı sayı',
        styleId: 360,
        command: "BEJ 12.500 adet, %5 internet"
    }
];

/**
 * API Health Check
 */
async function checkHealth() {
    try {
        console.log('🏥 Health check yapılıyor...');
        const response = await axios.get(`${API_URL}/health`);
        console.log('✅ API çalışıyor:', response.data);
        console.log('');
        return true;
    } catch (error) {
        console.error('❌ API\'ye bağlanılamadı:', error.message);
        console.error('⚠️  Lütfen API\'yi başlatın: node server.js');
        return false;
    }
}

/**
 * Parse command testi
 */
async function testParseCommand(testCase) {
    try {
        console.log(`\n📋 ${testCase.name}`);
        console.log('='.repeat(70));
        console.log('📤 Request:');
        console.log('   StyleID:', testCase.styleId);
        console.log('   Komut:', testCase.command);

        const response = await axios.post(`${API_URL}/parse-command`, {
            styleId: testCase.styleId,
            command: testCase.command
        });

        console.log('\n📥 Response:');
        console.log('   Status:', response.data.status);
        console.log('   Message:', response.data.message);
        console.log('   Data:', JSON.stringify(response.data.data, null, 4));
        console.log('✅ Test başarılı!\n');

        return {
            success: true,
            data: response.data
        };

    } catch (error) {
        console.error('\n❌ Test başarısız!');
        console.error('   Hata:', error.response?.data || error.message);
        console.log('');

        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
}

/**
 * Tüm testleri çalıştır
 */
async function runAllTests() {
    console.log('\n' + '🚀'.repeat(35));
    console.log('ChatdenPO API - OpenAI Parsing Testleri');
    console.log('🚀'.repeat(35) + '\n');

    // Health check
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        process.exit(1);
    }

    // Test sonuçları
    const results = [];

    for (const testCase of testCases) {
        const result = await testParseCommand(testCase);
        results.push({
            name: testCase.name,
            success: result.success
        });

        // Rate limiting için biraz bekle
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Özet
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SONUÇLARI');
    console.log('='.repeat(70));

    results.forEach((result, index) => {
        const icon = result.success ? '✅' : '❌';
        console.log(`${icon} ${result.name}`);
    });

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    console.log('\n' + '='.repeat(70));
    console.log(`🎯 Başarı Oranı: ${successCount}/${totalCount} (${Math.round(successCount / totalCount * 100)}%)`);
    console.log('='.repeat(70) + '\n');
}

// Testleri başlat
runAllTests().catch(error => {
    console.error('❌ Test suite hatası:', error.message);
    process.exit(1);
});

