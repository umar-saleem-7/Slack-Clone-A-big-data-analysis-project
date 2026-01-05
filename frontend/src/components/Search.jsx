import { useState } from 'react';
import api from '../services/api';
import '../styles/Search.css';

function Search({ workspaceId, onClose }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();

        if (!searchQuery.trim()) return;

        try {
            setLoading(true);
            setSearched(true);

            const params = new URLSearchParams({
                q: searchQuery,
                limit: 50,
            });

            if (workspaceId) {
                params.append('workspaceId', workspaceId);
            }

            const response = await api.get(`/search?${params.toString()}`);
            setResults(response.data.results);
        } catch (error) {
            console.error('Search failed:', error);
            alert('Search failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const highlightText = (text, query) => {
        if (!query) return text;

        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return parts.map((part, index) =>
            part.toLowerCase() === query.toLowerCase() ? (
                <mark key={index}>{part}</mark>
            ) : (
                part
            )
        );
    };

    return (
        <div className="search-overlay" onClick={onClose}>
            <div className="search-modal" onClick={(e) => e.stopPropagation()}>
                <div className="search-header">
                    <h2>Search Messages</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSearch} className="search-form">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                    <button type="submit" className="btn btn-primary" disabled={loading || !searchQuery.trim()}>
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </form>

                <div className="search-results">
                    {loading ? (
                        <div className="search-loading">
                            <div className="spinner"></div>
                            <p>Searching...</p>
                        </div>
                    ) : searched && results.length === 0 ? (
                        <div className="search-empty">
                            <p>No messages found for "{searchQuery}"</p>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="results-list">
                            <p className="results-count">{results.length} results found</p>
                            {results.map((result) => (
                                <div key={result.message_id} className="result-item">
                                    <div className="result-header">
                                        <span className="result-author">{result.user_name}</span>
                                        <span className="result-time">{formatTime(result.timestamp)}</span>
                                    </div>
                                    <div className="result-text">
                                        {highlightText(result.message_text, searchQuery)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="search-placeholder">
                            <p>🔍 Search for messages across all channels</p>
                            <p className="search-hint">Enter keywords to find messages</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Search;
