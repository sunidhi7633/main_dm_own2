import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Dynamic params
    const hasTitle = searchParams.has('title');
    const title = hasTitle
      ? searchParams.get('title')?.slice(0, 100)
      : 'Harshwal & Company LLP';
      
    const category = searchParams.get('category') || 'Update';

    return new ImageResponse(
      (
        <div
          style={{
            backgroundColor: '#faf9f5', // canvas
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '80px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Top Brand Tag */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 600,
                color: '#cc785c', // brand-primary
                letterSpacing: '-1px',
              }}
            >
              Harshwal & Company LLP
            </div>
            <div
              style={{
                backgroundColor: '#efe9de', // surface-card
                color: '#141413', // ink
                padding: '12px 24px',
                borderRadius: '9999px',
                fontSize: 24,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
              }}
            >
              {category}
            </div>
          </div>

          {/* Main Headline */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <div
              style={{
                fontSize: 80,
                fontWeight: 600,
                color: '#141413',
                lineHeight: 1.1,
                letterSpacing: '-2px',
                maxWidth: '900px',
              }}
            >
              {title}
            </div>
          </div>

          {/* Bottom Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              borderTop: '2px solid #e6dfd8',
              paddingTop: '40px',
            }}
          >
            <div style={{ fontSize: 28, color: '#6c6a64' }}>
              Automation & Competitive Intelligence
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
