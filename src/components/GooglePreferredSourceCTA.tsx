import React from 'react';

const GooglePreferredSourceCTA: React.FC = () => {
  return (
    <div className="text-center bg-gray-50 border border-gray-200 rounded-xl px-6 py-8 max-w-2xl mx-auto">
      <h3 className="text-lg font-bold text-gray-900 mb-2">
        Like our content? Follow us on Google
      </h3>
      <p className="text-sm text-gray-600 mb-5 max-w-md mx-auto">
        Add Buyawarranty as a preferred source so our latest warranty advice and guides show up more often in your Google search results.
      </p>
      <a
        href="https://www.google.com/preferences/source?q=buyawarranty.co.uk"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-[#eb4b00] hover:bg-[#d63f00] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21.35 11.1H12v3.2h5.35c-.5 2.4-2.55 3.7-5.35 3.7-3.25 0-5.9-2.65-5.9-5.9s2.65-5.9 5.9-5.9c1.5 0 2.85.55 3.9 1.45l2.4-2.4C16.55 3.7 14.4 2.85 12 2.85 6.95 2.85 2.85 6.95 2.85 12s4.1 9.15 9.15 9.15c5.3 0 8.8-3.7 8.8-8.9 0-.4-.05-.8-.1-1.15z"/>
        </svg>
        Add to Google
      </a>
    </div>
  );
};

export default GooglePreferredSourceCTA;
