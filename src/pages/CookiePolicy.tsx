import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Shield, Eye, Settings, Target } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import pandaService from '@/assets/panda-service.png';
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';
import pandaSavings from '@/assets/panda-savings.png';

const CookiePolicy = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <SEOHead 
        title="Cookie Policy | Buy A Warranty UK"
        description="Learn about how Buy A Warranty uses cookies and similar technologies on our website. Understand your privacy and cookie preferences."
        keywords="cookie policy, privacy, Buy A Warranty, cookies, website tracking, data protection"
        canonical="https://buyawarranty.co.uk/cookies"
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-900 to-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img 
                src={pandaService} 
                alt="Panda with shield representing cookie protection" 
                className="h-24 w-auto"
              />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Cookie Policy
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Understanding how we use cookies and similar technologies to improve your experience on our website.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {/* Introduction */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          <div className="flex items-start space-x-6">
            <img 
              src={pandaThumbsUp} 
              alt="Panda giving thumbs up" 
              className="h-20 w-auto flex-shrink-0"
            />
            <div>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                This Cookie Policy explains how Buy A Warranty ("we", "us", or "our") uses cookies and similar technologies on our website{' '}
                <a href="https://buyawarranty.co.uk" className="text-[#eb4b00] hover:underline">
                  https://buyawarranty.co.uk
                </a>. By continuing to use our website, you consent to the use of cookies as described in this policy.
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                <p className="text-blue-800 font-medium">
                  <strong>PDF Version:</strong> You can also download our complete Cookie Policy as a{' '}
                  <a href="/Terms-and-Conditions-Your-Extended-Warranty-Guide-v2.2-2.pdf" target="_blank" className="text-[#eb4b00] hover:underline">
                    PDF document
                  </a>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* What Are Cookies */}
        <section className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
            <Shield className="w-8 h-8 text-[#eb4b00] mr-3" />
            What Are Cookies?
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed">
            Cookies are small text files placed on your device when you visit a website. They help us improve your experience by remembering your preferences, enabling certain functionalities, and analysing how our website is used.
          </p>
        </section>

        {/* Types of Cookies */}
        <section className="space-y-6 mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Types of Cookies We Use</h2>
          
          {/* Essential Cookies */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="w-6 h-6 text-green-600 mr-3" />
              Essential Cookies
            </h3>
            <p className="text-gray-700 leading-relaxed">
              These cookies are necessary for the website to function properly. They enable core features such as security, network management, and accessibility. These cookies cannot be turned off as they are essential for the website to work.
            </p>
          </div>

          {/* Performance and Analytics */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Eye className="w-6 h-6 text-blue-600 mr-3" />
              Performance and Analytics Cookies
            </h3>
            <p className="text-gray-700 leading-relaxed">
              These cookies help us understand how visitors interact with our website by collecting information anonymously. We use tools like Google Analytics to monitor traffic and improve site performance. This helps us provide you with a better user experience.
            </p>
          </div>

          {/* Functionality Cookies */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Settings className="w-6 h-6 text-purple-600 mr-3" />
              Functionality Cookies
            </h3>
            <p className="text-gray-700 leading-relaxed">
              These cookies allow the website to remember choices you make (such as your region or language) and provide enhanced, more personalised features. They may also be used to provide services you have asked for, such as watching a video or commenting on a blog.
            </p>
          </div>

          {/* Advertising and Targeting */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Target className="w-6 h-6 text-orange-600 mr-3" />
              Advertising and Targeting Cookies
            </h3>
            <p className="text-gray-700 leading-relaxed">
              These cookies may be set through our site by advertising partners. They may be used to build a profile of your interests and show you relevant adverts on other sites. They work by uniquely identifying your browser and device.
            </p>
          </div>
        </section>

        {/* Managing Cookies */}
        <section className="bg-gradient-to-r from-orange-50 to-blue-50 rounded-2xl p-8 mb-8">
          <div className="flex items-start space-x-6">
            <img 
              src={pandaSavings} 
              alt="Panda with gear representing cookie management" 
              className="h-20 w-auto flex-shrink-0"
            />
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Managing Cookies</h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                You can manage or disable cookies through your browser settings. Please note that disabling certain cookies may affect the functionality of our website.
              </p>
              <p className="text-gray-700 leading-relaxed">
                For more information on managing cookies, visit{' '}
                <a href="https://www.aboutcookies.org" target="_blank" rel="noopener noreferrer" className="text-[#eb4b00] hover:underline">
                  www.aboutcookies.org
                </a>{' '}
                or{' '}
                <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer" className="text-[#eb4b00] hover:underline">
                  www.allaboutcookies.org
                </a>.
              </p>
            </div>
          </div>
        </section>

        {/* Third-Party Cookies */}
        <section className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Third-Party Cookies</h2>
          <p className="text-lg text-gray-700 leading-relaxed">
            We may use third-party services (e.g. Google, Meta) that set cookies on our behalf to deliver targeted advertising and analytics. These third parties are responsible for their own cookie policies. We recommend reviewing their privacy policies to understand how they use cookies.
          </p>
        </section>

        {/* Changes to Policy */}
        <section className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Changes to This Policy</h2>
          <p className="text-lg text-gray-700 leading-relaxed">
            We may update this Cookie Policy from time to time. Any changes will be posted on this page with an updated revision date. We encourage you to review this policy periodically to stay informed about how we use cookies.
          </p>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600 font-medium">
              <strong>Last updated:</strong> 16 September 2025
            </p>
          </div>
        </section>

        {/* Contact Information */}
        <section className="bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-2xl p-8">
          <h2 className="text-3xl font-bold mb-6">Need Help?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-4">Contact Our Support Team</h3>
              <div className="space-y-3">
                <p className="flex items-center">
                  <span className="font-medium mr-2">Phone:</span>
                  <a href="tel:03302295040" className="text-orange-300 hover:text-orange-200 transition-colors">
                    0330 229 5040
                  </a>
                </p>
                <p className="flex items-center">
                  <span className="font-medium mr-2">Email:</span>
                  <a href="mailto:support@buyawarranty.co.uk" className="text-orange-300 hover:text-orange-200 transition-colors">
                    support@buyawarranty.co.uk
                  </a>
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">Quick Links</h3>
              <div className="space-y-2">
                <Link to="/privacy" className="block text-blue-200 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
                <Link to="/terms" className="block text-blue-200 hover:text-white transition-colors">
                  Terms & Conditions
                </Link>
                <Link to="/contact-us" className="block text-blue-200 hover:text-white transition-colors">
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default CookiePolicy;