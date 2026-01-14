import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Edit, Eye } from 'lucide-react';

const WikipediaRadar = () => {
  const [activeRadar, setActiveRadar] = useState('status');
  const [topArticles, setTopArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trendData, setTrendData] = useState([]);
  const [error, setError] = useState(null);

  // Fetch most viewed articles (Status Radar)
  const fetchTopArticles = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get yesterday's date (Wikipedia API requires specific date)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const year = yesterday.getFullYear();
      const month = String(yesterday.getMonth() + 1).padStart(2, '0');
      const day = String(yesterday.getDate()).padStart(2, '0');
      
      const response = await fetch(
        `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${year}/${month}/${day}`
      );
      
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const data = await response.json();
      const articles = data.items[0].articles
        .filter(a => !a.article.startsWith('Special:') && !a.article.startsWith('Main_Page'))
        .slice(0, 15)
        .map(a => ({
          title: a.article.replace(/_/g, ' '),
          views: a.views,
          rank: a.rank
        }));
      
      setTopArticles(articles);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Fetch trend data for a specific article (Futurity Radar)
  const fetchArticleTrend = async (articleTitle = 'Artificial_intelligence') => {
    setLoading(true);
    setError(null);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
      };
      
      const response = await fetch(
        `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${articleTitle}/daily/${formatDate(startDate)}/${formatDate(endDate)}`
      );
      
      if (!response.ok) throw new Error('Failed to fetch trend data');
      
      const data = await response.json();
      const trends = data.items.map(item => ({
        date: `${item.timestamp.slice(4, 6)}/${item.timestamp.slice(6, 8)}`,
        views: item.views
      }));
      
      setTrendData(trends);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Load initial data
  useEffect(() => {
    if (activeRadar === 'status') {
      fetchTopArticles();
    } else if (activeRadar === 'futurity') {
      fetchArticleTrend();
    }
  }, [activeRadar]);

  const radarTypes = [
    { id: 'status', name: 'Status Radar', icon: Users, description: 'Whose stories dominate collective attention?' },
    { id: 'futurity', name: 'Futurity Radar', icon: TrendingUp, description: 'What topics are gaining momentum?' },
    { id: 'norms', name: 'Norm Formation', icon: Edit, description: 'What knowledge is contested and edited?' }
  ];

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent">
            Wikipedia Narrative Radar
          </h1>
          <p className="text-gray-400">
            Analyzing cultural power through collective knowledge patterns
          </p>
        </div>

        {/* Radar Type Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {radarTypes.map(radar => {
            const Icon = radar.icon;
            return (
              <button
                key={radar.id}
                onClick={() => setActiveRadar(radar.id)}
                className={`p-6 rounded-lg border transition-all ${
                  activeRadar === radar.id
                    ? 'bg-orange-500/10 border-orange-500 shadow-lg shadow-orange-500/20'
                    : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <Icon className="w-8 h-8 mb-2" />
                <h3 className="font-semibold text-lg mb-1">{radar.name}</h3>
                <p className="text-sm text-gray-400">{radar.description}</p>
              </button>
            );
          })}
        </div>

        {/* Main Dashboard Area */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
              <p className="mt-4 text-gray-400">Loading narrative data...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-500 rounded p-4 mb-4">
              <p className="text-red-300">Error: {error}</p>
            </div>
          )}

          {/* Status Radar View */}
          {activeRadar === 'status' && !loading && topArticles.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <Eye className="w-6 h-6 mr-2" />
                Most Viewed Articles (Yesterday)
              </h2>
              <p className="text-gray-400 mb-6">
                These are the stories that captured collective attention. Notice patterns in who gets visibility.
              </p>
              
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={topArticles}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis 
                    dataKey="title" 
                    angle={-45} 
                    textAnchor="end" 
                    height={150}
                    stroke="#525252"
                    tick={{ fill: '#737373', fontSize: 12 }}
                  />
                  <YAxis stroke="#525252" tick={{ fill: '#737373' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626' }}
                    labelStyle={{ color: '#fafafa' }}
                  />
                  <Bar dataKey="views" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded">
                  <h3 className="font-semibold mb-2 text-orange-500">Hegemonic Signals:</h3>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Celebrity vs. intellectual content ratio</li>
                    <li>• Geographic representation (Western bias?)</li>
                    <li>• Gender representation in top articles</li>
                    <li>• Current events vs. evergreen content</li>
                  </ul>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded">
                  <h3 className="font-semibold mb-2 text-orange-500">Questions to Ask:</h3>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Whose lives are considered worthy of attention?</li>
                    <li>• What events are framed as globally important?</li>
                    <li>• Which languages/cultures dominate?</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Futurity Radar View */}
          {activeRadar === 'futurity' && !loading && trendData.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <TrendingUp className="w-6 h-6 mr-2" />
                Article Trend: Artificial Intelligence (Last 30 Days)
              </h2>
              <p className="text-gray-400 mb-6">
                Rising trends indicate what people believe is important for understanding the future.
              </p>
              
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis dataKey="date" stroke="#525252" tick={{ fill: '#737373' }} />
                  <YAxis stroke="#525252" tick={{ fill: '#737373' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626' }}
                    labelStyle={{ color: '#fafafa' }}
                  />
                  <Line type="monotone" dataKey="views" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316' }} />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-6 bg-neutral-950 border border-neutral-800 p-4 rounded">
                <h3 className="font-semibold mb-2 text-orange-500">Try Different Topics:</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Change the article to track different cultural futures (edit the code or add input field)
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Climate_change', 'Cryptocurrency', 'ChatGPT', 'Ukraine', 'Taylor_Swift'].map(topic => (
                    <button
                      key={topic}
                      onClick={() => fetchArticleTrend(topic)}
                      className="px-3 py-1 bg-orange-600 hover:bg-orange-500 rounded text-sm transition-colors"
                    >
                      {topic.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Norm Formation View */}
          {activeRadar === 'norms' && !loading && (
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <Edit className="w-6 h-6 mr-2" />
                Norm Formation Radar
              </h2>
              <p className="text-gray-400 mb-6">
                Track edit wars and contested knowledge to see how norms are established.
              </p>
              
              <div className="bg-neutral-950 border border-neutral-800 p-6 rounded text-center">
                <p className="text-lg mb-4">🚧 Advanced Feature Coming Soon</p>
                <p className="text-gray-400">
                  This radar requires analyzing Wikipedia's revision history API to track:
                </p>
                <ul className="mt-4 text-left max-w-2xl mx-auto space-y-2 text-gray-400">
                  <li>• Edit frequency on controversial topics</li>
                  <li>• Reversal patterns (edit wars)</li>
                  <li>• Talk page discussion volume</li>
                  <li>• Protection status changes</li>
                </ul>
                <p className="mt-6 text-sm text-orange-500">
                  As you learn more, you can add this functionality using Wikipedia's revisions API
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Learning Notes */}
        <div className="mt-8 bg-neutral-900 border border-neutral-800 rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-3 text-orange-500">📚 Learning Notes</h3>
          <div className="text-sm text-gray-400 space-y-2">
            <p><strong>API Used:</strong> Wikimedia REST API (no key required)</p>
            <p><strong>Key Concepts:</strong></p>
            <ul className="ml-6 space-y-1">
              <li>• Status Radar: Pageview data reveals whose narratives dominate</li>
              <li>• Futurity Radar: Trending topics show collective anticipation</li>
              <li>• Norm Formation: Edit patterns reveal contested knowledge</li>
            </ul>
            <p className="pt-2"><strong>Next Steps:</strong> Try modifying the code to add search functionality, compare multiple articles, or track specific topics over longer periods.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WikipediaRadar;