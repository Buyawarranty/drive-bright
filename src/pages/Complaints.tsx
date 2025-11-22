import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Phone, Mail, Clock, AlertCircle, Shield, FileText, CheckCircle, MessageSquare, TrendingUp } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import pandaService from '@/assets/panda-service.png';
import pandaThumbsUp from '@/assets/panda-thumbs-up.png';
import pandaSavings from '@/assets/panda-savings.png';
import pandaHappyCar from '@/assets/panda-happy-car.png';

const Complaints = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <SEOHead 
        title="Complaints Procedure | Buy A Warranty UK"
        description="Learn about our complaints procedure and how we resolve customer concerns quickly and fairly. We are committed to providing excellent customer service."
        keywords="complaints procedure, customer service, Buy A Warranty, complaint resolution, fair treatment"
        canonical="https://buyawarranty.co.uk/complaints"
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-900 to-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img 
                src={pandaService} 
                alt="Panda representing excellent customer service" 
                className="h-24 w-auto"
              />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Complaints Procedure
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              At Buy A Warranty, we are committed to providing excellent customer service. If you are dissatisfied with any aspect of our service or products, we want to hear from you so we can resolve the issue promptly and fairly.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {/* How to Make a Complaint */}
        <section className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          <div className="flex items-start space-x-6">
            <img 
              src={pandaThumbsUp} 
              alt="Panda encouraging communication" 
              className="h-20 w-auto flex-shrink-0"
            />
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
                <MessageSquare className="w-8 h-8 text-[#eb4b00] mr-3" />
                How to Make a Complaint
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                You can submit a complaint using any of the following methods:
              </p>
              
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                    <Mail className="w-5 h-5 text-blue-600 mr-2" />
                    Email Us
                  </h3>
                  <a href="mailto:support@buyawarranty.co.uk" className="text-[#eb4b00] hover:underline font-medium">
                    support@buyawarranty.co.uk
                  </a>
                </div>
                <div className="bg-green-50 p-6 rounded-lg">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                    <Phone className="w-5 h-5 text-green-600 mr-2" />
                    Call Us
                  </h3>
                  <a href="tel:03302295040" className="text-[#eb4b00] hover:underline font-medium">
                    0330 229 5040
                  </a>
                  <p className="text-sm text-gray-600 mt-1">(Monday to Friday, 9am–5pm)</p>
                </div>
              </div>

              <div className="bg-orange-50 border-l-4 border-orange-400 p-6 rounded-r-lg">
                <h3 className="font-bold text-gray-900 mb-4">Please include the following details to help us investigate your complaint efficiently:</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-[#eb4b00] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    Your full name and contact details
                  </li>
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-[#eb4b00] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    Details of the product or service in question
                  </li>
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-[#eb4b00] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    A clear description of the issue
                  </li>
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-[#eb4b00] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    Any relevant documentation (e.g. warranty registration number, correspondence)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* What Happens Next */}
        <section className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          <div className="flex items-start space-x-6">
            <img 
              src={pandaHappyCar} 
              alt="Panda with car representing our process" 
              className="h-20 w-auto flex-shrink-0"
            />
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
                <TrendingUp className="w-8 h-8 text-[#eb4b00] mr-3" />
                What Happens Next
              </h2>
              
              <div className="space-y-8">
                {/* Acknowledgement */}
                <div className="border-l-4 border-blue-400 bg-blue-50 p-6 rounded-r-lg">
                  <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                    <CheckCircle className="w-6 h-6 text-blue-600 mr-2" />
                    1. Acknowledgement
                  </h3>
                  <p className="text-gray-700 text-lg">
                    We will acknowledge your complaint within <strong>2 working days</strong> of receipt.
                  </p>
                </div>

                {/* Investigation */}
                <div className="border-l-4 border-orange-400 bg-orange-50 p-6 rounded-r-lg">
                  <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                    <Shield className="w-6 h-6 text-orange-600 mr-2" />
                    2. Investigation
                  </h3>
                  <p className="text-gray-700 text-lg">
                    Your complaint will be reviewed by a member of our team. We aim to provide a full response within <strong>10 working days</strong>. If further investigation is required, we will keep you informed of progress.
                  </p>
                </div>

                {/* Resolution */}
                <div className="border-l-4 border-green-400 bg-green-50 p-6 rounded-r-lg">
                  <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                    <FileText className="w-6 h-6 text-green-600 mr-2" />
                    3. Resolution
                  </h3>
                  <p className="text-gray-700 text-lg">
                    We will explain our findings and any actions we propose to resolve your complaint.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Continuous Improvement */}
        <section className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-8 mb-8">
          <div className="flex items-start space-x-6">
            <img 
              src={pandaSavings} 
              alt="Panda representing continuous improvement" 
              className="h-20 w-auto flex-shrink-0"
            />
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
                <TrendingUp className="w-8 h-8 text-[#eb4b00] mr-3" />
                Continuous Improvement
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                All complaints are logged and reviewed regularly to help us improve our services and prevent future issues. Your feedback is valuable in helping us provide better service to all our customers.
              </p>
            </div>
          </div>
        </section>

        {/* Last Updated */}
        <section className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="text-center">
            <div className="bg-gray-50 p-4 rounded-lg inline-block">
              <p className="text-gray-600 font-medium">
                <strong>Last updated:</strong> 16 September 2025
              </p>
            </div>
          </div>
        </section>

        {/* Contact Information */}
        <section className="bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-2xl p-8">
          <h2 className="text-3xl font-bold mb-6 text-center">Ready to Raise a Complaint?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-4">Contact Our Team</h3>
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
                <p className="flex items-center">
                  <Clock className="w-5 h-5 mr-3" />
                  <span className="font-medium mr-2">Hours:</span>
                  <span className="text-blue-200">Monday to Friday, 9am–5pm</span>
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">Related Information</h3>
              <div className="space-y-2">
                <Link to="/contact-us" className="block text-blue-200 hover:text-white transition-colors">
                  Contact Us Page
                </Link>
                <Link to="/faq" className="block text-blue-200 hover:text-white transition-colors">
                  Frequently Asked Questions
                </Link>
                <Link to="/terms" className="block text-blue-200 hover:text-white transition-colors">
                  Terms & Conditions
                </Link>
                <Link to="/privacy" className="block text-blue-200 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Complaints;