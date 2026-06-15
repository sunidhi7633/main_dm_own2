import asyncio
import httpx
from bs4 import BeautifulSoup
from typing import Dict, Any

async def scrape_firm_metrics(url: str) -> Dict[str, Any]:
    """Scrapes a CPA firm website for trust signals and service count."""
    metrics = {
        "word_count": 0,
        "services_count": 0,
        "has_blog": False,
        "has_case_studies": False,
        "trust_signals_count": 0
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, follow_redirects=True)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, "html.parser")
                text = soup.get_text(separator=' ')
                
                # Basic metrics
                metrics["word_count"] = len(text.split())
                
                # Heuristic keyword checks
                text_lower = text.lower()
                metrics["has_blog"] = "blog" in text_lower or "insights" in text_lower
                metrics["has_case_studies"] = "case studies" in text_lower or "client success" in text_lower
                
                # Count trust signals (awards, CPA badges, etc.)
                trust_keywords = ["award", "certified", "cpa", "testimonial", "featured in"]
                metrics["trust_signals_count"] = sum(1 for kw in trust_keywords if kw in text_lower)
                
                # Estimate services based on standard links
                services_keywords = ["audit", "tax", "advisory", "bookkeeping", "consulting", "compliance"]
                metrics["services_count"] = sum(1 for kw in services_keywords if kw in text_lower)
    except Exception as e:
        print(f"Failed to scrape {url}: {e}")
        
    return metrics

def calculate_presence_score(metrics: Dict[str, Any]) -> float:
    """
    Calculates the 0-100 digital presence score based on the formula from the documentation.
    website_score = (word_count/5000 + services_count/20 + has_blog + has_case_studies) / 4
    trust_score = trust_signals_count / 5
    Total = (website_score * 0.6 + trust_score * 0.4) * 100
    """
    # Normalize metrics (cap at 1.0)
    word_score = min(metrics["word_count"] / 5000.0, 1.0)
    service_score = min(metrics["services_count"] / 20.0, 1.0)
    blog_score = 1.0 if metrics["has_blog"] else 0.0
    case_score = 1.0 if metrics["has_case_studies"] else 0.0
    
    website_score = (word_score + service_score + blog_score + case_score) / 4.0
    
    trust_score = min(metrics["trust_signals_count"] / 5.0, 1.0)
    
    presence_score = (website_score * 0.6 + trust_score * 0.4) * 100
    return round(presence_score, 2)

async def analyze_competitor_batch(urls: list[str]) -> Dict[str, float]:
    """
    Runs analysis concurrently. Replaces the old serial Windows Playwright agent.
    """
    print(f"Analyzing {len(urls)} competitors concurrently...")
    
    tasks = [scrape_firm_metrics(url) for url in urls]
    results = await asyncio.gather(*tasks)
    
    scores = {}
    for url, metrics in zip(urls, results):
        score = calculate_presence_score(metrics)
        scores[url] = score
        print(f"[{url}] Presence Score: {score}/100")
        
    return scores

if __name__ == "__main__":
    test_urls = [
        "https://www.harshwalconsulting.com/",
        "https://www.mossadams.com/"
    ]
    asyncio.run(analyze_competitor_batch(test_urls))
