import asyncio
import httpx
from bs4 import BeautifulSoup
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate

async def check_website_alive(url: str) -> bool:
    """Async check if a competitor's website is alive and not parked."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, follow_redirects=True)
            if response.status_code == 200:
                # Basic check for parked domains
                text = response.text.lower()
                if "this domain is for sale" in text or "parked" in text:
                    return False
                return True
    except Exception:
        pass
    return False

async def discover_competitors(n: int = 5):
    """
    Orchestrated competitor discovery using an LLM.
    Replaces the old serial Agent 1 script.
    """
    print("Starting automated competitor discovery...")
    llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
    
    prompt = PromptTemplate.from_template(
        "You are an expert market researcher. Identify {n} direct CPA and accounting firm competitors "
        "to 'Harshwal & Company LLP' in the United States. "
        "Return the list strictly as a comma-separated list of their exact website URLs. "
        "Do not include any other text."
    )
    
    # 1. Ask LLM to brainstorm competitors
    response = await llm.ainvoke(prompt.format(n=n))
    urls = [url.strip() for url in response.content.split(",") if url.strip()]
    
    print(f"LLM suggested {len(urls)} competitors. Validating URLs concurrently...")
    
    # 2. Concurrently validate all websites (Fixes the Windows MAX_WORKERS=1 issue)
    tasks = [check_website_alive(url) for url in urls]
    results = await asyncio.gather(*tasks)
    
    active_competitors = [url for url, is_alive in zip(urls, results) if is_alive]
    
    print(f"Discovery complete. Found {len(active_competitors)} active competitor websites.")
    return active_competitors

if __name__ == "__main__":
    # Test the pipeline
    asyncio.run(discover_competitors(3))
