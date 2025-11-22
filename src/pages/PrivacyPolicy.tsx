import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Shield, User, Eye, Lock, FileText, Users, Clock, AlertTriangle, Phone, Mail } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import pandaService from '@/assets/panda-service.png';
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';
import pandaSavings from '@/assets/panda-savings.png';
import pandaHappyCar from '@/assets/panda-happy-car.png';

const PrivacyPolicy = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <SEOHead 
        title="Privacy Policy | Buy A Warranty UK"
        description="Learn how Buy A Warranty protects your privacy and handles your personal data. Understand your rights under UK GDPR and how we use your information."
        keywords="privacy policy, data protection, Buy A Warranty, GDPR, personal data, privacy rights"
        canonical="https://buyawarranty.co.uk/privacy"
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16">
          <div className="flex items-center justify-between h-full">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="hover:opacity-80 transition-opacity">
                <img 
                  src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" 
                  alt="Buy a Warranty" 
                  className="h-6 sm:h-8 w-auto"
                />
              </Link>
            </div>

            {/* Navigation - Hidden on mobile */}
            <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
              <Link to="/what-is-covered" className="text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base">What's Covered</Link>
              <Link to="/make-a-claim" className="text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base">Make a Claim</Link>
              <Link to="/faq" className="text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base">FAQs</Link>
              <Link to="/contact-us" className="text-gray-700 hover:text-gray-900 font-medium text-sm xl:text-base">Contact Us</Link>
            </nav>

            {/* Desktop CTA Buttons - Show on desktop */}
            <div className="hidden lg:flex items-center space-x-3">
              <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer">
                <button className="bg-[#25D366] text-white border-[#25D366] hover:bg-[#1da851] hover:border-[#1da851] px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  WhatsApp Us
                </button>
              </a>
              <Link to="/">
                <button className="bg-primary text-white hover:bg-primary/90 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Get my quote
                </button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 min-w-[48px] min-h-[48px]"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-12 w-12" /> : <Menu className="h-12 w-12" />}
            </button>
          </div>

          {/* Mobile menu */}
          {isMenuOpen && (
            <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg">
              <div className="flex flex-col p-4 space-y-4">
                <Link to="/what-is-covered" className="text-gray-700 hover:text-gray-900 font-medium py-2">
                  What's Covered
                </Link>
                <Link to="/make-a-claim" className="text-gray-700 hover:text-gray-900 font-medium py-2">
                  Make a Claim
                </Link>
                <Link to="/faq" className="text-gray-700 hover:text-gray-900 font-medium py-2">
                  FAQs
                </Link>
                <Link to="/contact-us" className="text-gray-700 hover:text-gray-900 font-medium py-2">
                  Contact Us
                </Link>
                <div className="flex flex-col space-y-3 pt-4 border-t border-gray-200">
                  <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer">
                    <button className="w-full bg-[#25D366] text-white px-4 py-2 rounded-md text-sm font-medium">
                      WhatsApp Us
                    </button>
                  </a>
                  <Link to="/" className="w-full">
                    <button className="w-full bg-primary text-white px-4 py-2 rounded-md text-sm font-medium">
                      Get my quote
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-900 to-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img 
                src={pandaService} 
                alt="Panda with shield representing data protection" 
                className="h-24 w-auto"
              />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Privacy Policy
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Your privacy matters to us. Learn how we protect and handle your personal information with transparency and care.
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
              alt="Panda giving thumbs up for privacy protection" 
              className="h-20 w-auto flex-shrink-0"
            />
            <div>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Buy A Warranty ("we", "us", or "our") is committed to protecting your privacy. This policy outlines how we collect, use, and safeguard your personal data when you visit our website{' '}
                <a href="https://buyawarranty.co.uk" className="text-[#eb4b00] hover:underline">
                  https://buyawarranty.co.uk
                </a>{' '}
                or interact with our services.
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                <p className="text-blue-800 font-medium">
                  <strong>PDF Version:</strong> You can also download our complete Privacy Policy as a{' '}
                  <a href="/Terms-and-Conditions-Your-Extended-Warranty-Guide-v2.2-2.pdf" target="_blank" className="text-[#eb4b00] hover:underline">
                    PDF document
                  </a>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Who We Are */}
        <section className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
            <User className="w-8 h-8 text-[#eb4b00] mr-3" />
            1. Who We Are
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed">
            Buy A Warranty is a UK-based provider of vehicle warranty products. We act as the data controller for the personal information you provide to us.
          </p>
        </section>

        {/* What Information We Collect */}
        <section className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
            <FileText className="w-8 h-8 text-[#eb4b00] mr-3" />
            2. What Information We Collect
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            We may collect and process the following types of personal data:
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <User className="w-5 h-5 text-blue-600 mr-2" />
                Contact Details
              </h3>
              <p className="text-gray-700">Name, email address, phone number</p>
            </div>
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <FileText className="w-5 h-5 text-green-600 mr-2" />
                Vehicle Information
              </h3>
              <p className="text-gray-700">Make, model, registration number</p>
            </div>
            <div className="bg-orange-50 p-6 rounded-lg">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <Lock className="w-5 h-5 text-orange-600 mr-2" />
                Payment Details
              </h3>
              <p className="text-gray-700">Billing address, transaction history (processed securely via third-party providers)</p>
            </div>
            <div className="bg-purple-50 p-6 rounded-lg">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <Eye className="w-5 h-5 text-purple-600 mr-2" />
                Usage Data
              </h3>
              <p className="text-gray-700">IP address, browser type, pages visited, and other analytics data</p>
            </div>
          </div>
        </section>

        {/* How We Use Your Information */}
        <section className="bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl p-8 mb-8">
          <div className="flex items-start space-x-6">
            <img 
              src={pandaHappyCar} 
              alt="Happy panda with car representing service provision" 
              className="h-20 w-auto flex-shrink-0"
            />
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">3. How We Use Your Information</h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                We use your personal data to:
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#eb4b00] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Provide and manage warranty services
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#eb4b00] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Process payments and issue documentation
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#eb4b00] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Respond to enquiries and provide customer support
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#eb4b00] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Improve our website and services
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-[#eb4b00] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Send you relevant marketing communications (with your consent)
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Legal Basis for Processing */}
        <section className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
            <Shield className="w-8 h-8 text-[#eb4b00] mr-3" />
            4. Legal Basis for Processing
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            We process your data under the following legal bases:
          </p>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-400 bg-blue-50 p-4 rounded-r-lg">
              <h3 className="font-bold text-gray-900 mb-2">Contractual necessity</h3>
              <p className="text-gray-700">To fulfil our agreement with you</p>
            </div>
            <div className="border-l-4 border-green-400 bg-green-50 p-4 rounded-r-lg">
              <h3 className="font-bold text-gray-900 mb-2">Legal obligation</h3>
              <p className="text-gray-700">To comply with applicable laws</p>
            </div>
            <div className="border-l-4 border-orange-400 bg-orange-50 p-4 rounded-r-lg">
              <h3 className="font-bold text-gray-900 mb-2">Consent</h3>
              <p className="text-gray-700">For marketing and optional communications</p>
            </div>
            <div className="border-l-4 border-purple-400 bg-purple-50 p-4 rounded-r-lg">
              <h3 className="font-bold text-gray-900 mb-2">Legitimate interests</h3>
              <p className="text-gray-700">To improve our services and prevent fraud</p>
            </div>
          </div>
        </section>

        {/* Sharing Your Information */}
        <section className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
            <Users className="w-8 h-8 text-[#eb4b00] mr-3" />
            5. Sharing Your Information
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            We may share your data with:
          </p>
          <ul className="space-y-3 text-gray-700 mb-6">
            <li className="flex items-start">
              <span className="w-2 h-2 bg-[#eb4b00] rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Warranty providers and underwriters
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-[#eb4b00] rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Payment processors
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-[#eb4b00] rounded-full mt-2 mr-3 flex-shrink-0"></span>
              IT and analytics service providers
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-[#eb4b00] rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Regulatory authorities where required by law
            </li>
          </ul>
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
            <p className="text-red-800 font-medium">
              <strong>Important:</strong> We do not sell your personal data to third parties.
            </p>
          </div>
        </section>

        {/* Data Retention & Your Rights */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <section className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <Clock className="w-6 h-6 text-[#eb4b00] mr-3" />
              6. Data Retention
            </h2>
            <p className="text-gray-700 leading-relaxed">
              We retain your personal data only for as long as necessary to fulfil the purposes outlined in this policy, or as required by law.
            </p>
          </section>

          <section className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <Shield className="w-6 h-6 text-[#eb4b00] mr-3" />
              7. Your Rights
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Under UK GDPR, you have the right to:
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Access your personal data</li>
              <li>• Request correction or deletion</li>
              <li>• Object to or restrict processing</li>
              <li>• Withdraw consent at any time</li>
              <li>• Lodge a complaint with the ICO</li>
            </ul>
          </section>
        </div>

        {/* Cookies, Security & Changes */}
        <div className="space-y-8 mb-12">
          <section className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Eye className="w-6 h-6 text-[#eb4b00] mr-3" />
              8. Cookies
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Please refer to our{' '}
              <Link to="/cookies" className="text-[#eb4b00] hover:underline font-medium">
                Cookie Policy
              </Link>{' '}
              for details on how we use cookies and similar technologies.
            </p>
          </section>

          <section className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-8">
            <div className="flex items-start space-x-6">
              <img 
                src={pandaSavings} 
                alt="Panda with lock representing security" 
                className="h-16 w-auto flex-shrink-0"
              />
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                  <Lock className="w-6 h-6 text-[#eb4b00] mr-3" />
                  9. Security
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  We implement appropriate technical and organisational measures to protect your data from unauthorised access, loss, or misuse.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <AlertTriangle className="w-6 h-6 text-[#eb4b00] mr-3" />
              10. Changes to This Policy
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated revision date.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-600 font-medium">
                <strong>Last updated:</strong> 16 September 2025
              </p>
            </div>
          </section>
        </div>

        {/* Contact Information */}
        <section className="bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-2xl p-8">
          <h2 className="text-3xl font-bold mb-6">Need Help with Your Privacy Rights?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-4">Contact Our Data Protection Team</h3>
              <div className="space-y-3">
                <p className="flex items-center">
                  <Phone className="w-5 h-5 mr-3" />
                  <span className="font-medium mr-2">Phone:</span>
                  <a href="tel:03302295040" className="text-orange-300 hover:text-orange-200 transition-colors">
                    0330 229 5040
                  </a>
                </p>
                <p className="flex items-center">
                  <Mail className="w-5 h-5 mr-3" />
                  <span className="font-medium mr-2">Email:</span>
                  <a href="mailto:support@buyawarranty.co.uk" className="text-orange-300 hover:text-orange-200 transition-colors">
                    support@buyawarranty.co.uk
                  </a>
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">Related Policies</h3>
              <div className="space-y-2">
                <Link to="/cookies" className="block text-blue-200 hover:text-white transition-colors">
                  Cookie Policy
                </Link>
                <Link to="/terms" className="block text-blue-200 hover:text-white transition-colors">
                  Terms & Conditions
                </Link>
                <Link to="/contact-us" className="block text-blue-200 hover:text-white transition-colors">
                  Contact Us
                </Link>
                <a 
                  href="https://ico.org.uk/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="block text-blue-200 hover:text-white transition-colors"
                >
                  ICO (Information Commissioner's Office)
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default PrivacyPolicy;