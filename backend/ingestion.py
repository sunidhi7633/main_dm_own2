import os
from langchain_community.document_loaders import WebBaseLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import PGVector
from .database import DATABASE_URL, engine, Base

# Ensure the pgvector extension is created in the database and tables exist
Base.metadata.create_all(bind=engine)

def get_vector_store():
    embeddings = OpenAIEmbeddings()
    # PGVector from langchain takes a connection string
    # We use the same URL but with psycopg2
    connection_string = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://")
    
    store = PGVector(
        connection_string=connection_string,
        embedding_function=embeddings,
        collection_name="harshwal_knowledge_base",
        use_jsonb=True,
    )
    return store

def ingest_url(url: str):
    """Scrape a URL and index it into the vector database."""
    print(f"Loading content from {url}...")
    loader = WebBaseLoader(url)
    docs = loader.load()
    
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    splits = text_splitter.split_documents(docs)
    
    print(f"Indexing {len(splits)} chunks...")
    store = get_vector_store()
    store.add_documents(splits)
    print("Ingestion complete.")

def ingest_text_file(filepath: str):
    """Load a local text/markdown file and index it."""
    print(f"Loading content from {filepath}...")
    loader = TextLoader(filepath)
    docs = loader.load()
    
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    splits = text_splitter.split_documents(docs)
    
    print(f"Indexing {len(splits)} chunks...")
    store = get_vector_store()
    store.add_documents(splits)
    print("Ingestion complete.")

if __name__ == "__main__":
    # Example usage:
    # ingest_url("https://www.harshwalconsulting.com/")
    print("Vector database ingestion utilities loaded.")
