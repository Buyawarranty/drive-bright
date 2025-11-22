import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Calendar, User, Clock, ChevronRight, Menu, Phone, Shield, Check } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { SeasonalOfferBanner } from '@/components/SeasonalOfferBanner';
import pandaHeroImage from '@/assets/blog-hero-panda-mechanic.png';
import warrantyCarImage from '@/assets/blog-hero-warranty-car.png';

const Blog = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const navigate = useNavigate();

  const navigateToQuoteForm = () => {
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const blogPosts = [
    {
      id: 1,
      title: "Is a Car Warranty Worth It in the UK? What Drivers Need to Know",
      excerpt: "Explore the true value of car warranties for UK drivers. Learn about common repair costs, how warranties can save you money, and whether extended coverage is right for your vehicle.",
      author: "Sarah Johnson",
      date: "March 18, 2024",
      readTime: "7 min read",
      category: "Warranty Guides",
      image: warrantyCarImage,
      featured: true
    },
    {
      id: 2,
      title: "Top 5 Things to Check Before Buying a Used Car Warranty",
      excerpt: "A comprehensive checklist covering claim limits, exclusions, approved garages, and customer service. Make informed decisions and feel confident in your warranty purchase.",
      author: "Mike Thompson",
      date: "March 15, 2024",
      readTime: "6 min read",
      category: "Buying Guides",
      image: "/lovable-uploads/car-warranty-uk-compare-quotes.png",
      featured: false
    },
    {
      id: 3,
      title: "Van Warranty vs Car Warranty: What's the Difference and Which Do You Need?",
      excerpt: "Essential guide for tradespeople and small business owners. Understand coverage differences, usage scenarios, and why van warranties are crucial for commercial vehicles.",
      author: "Emma Davis",
      date: "March 12, 2024",
      readTime: "8 min read",
      category: "Commercial Coverage",
      image: pandaHeroImage,
      featured: false
    }
  ];

  const categories = ['All', 'Warranty Guides', 'Buying Guides', 'Commercial Coverage', 'Claims Process', 'Vehicle Maintenance'];
  
  const featuredPost = blogPosts.find(post => post.featured);
  
  const filteredPosts = selectedCategory === 'All' 
    ? blogPosts.filter(post => !post.featured)
    : blogPosts.filter(post => !post.featured && post.category === selectedCategory);
  
  const recentPosts = filteredPosts.slice(0, 4);
  const olderPosts = filteredPosts.slice(4);

  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "The Warranty Hub",
    "description": "Expert car warranty advice, vehicle maintenance tips, and driving guides for UK motorists",
    "url": "https://buyawarranty.co.uk/thewarrantyhub",
    "publisher": {
      "@type": "Organization",
      "name": "Buy a Warranty",
      "logo": {
        "@type": "ImageObject",
        "url": "https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png"
      }
    }
  };

  return (
    <>
      <SEOHead 
        title="Best Car Warranty UK | Expert Vehicle Protection Advice & Tips"
        description="Get expert advice on car warranties across the UK. Compare car and van warranties in Manchester, Birmingham, London & nationwide. Affordable cover and peace of mind today."
        keywords="best car warranty UK, UK car warranty advice, car warranty Manchester, vehicle warranty Birmingham, van warranty London, car protection plans UK, affordable car cover UK, driving tips UK, car maintenance UK, used car warranty UK"
        canonical="https://buyawarranty.co.uk/thewarrantyhub"
        ogImage={pandaHeroImage}
      />
      
      {/* Schema Markup */}
      <script type="application/ld+json">
        {JSON.stringify(schemaMarkup)}
      </script>

      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="relative bg-white py-16 md:py-20 border-b border-gray-200">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
              <div className="space-y-6">
                <div className="space-y-4">
                  <Badge className="bg-primary text-white px-4 py-1 text-sm font-medium">
                    The Warranty Hub
                  </Badge>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                    Expert Advice for UK Car Owners
                  </h1>
                  <p className="text-xl text-gray-600 leading-relaxed">
                    Guides, tips, and insights to help you protect your vehicle and make informed warranty decisions.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button 
                    size="lg"
                    onClick={navigateToQuoteForm}
                    className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg font-semibold"
                  >
                    Get Your Free Quote
                  </Button>
                  <a href="tel:03302295040">
                    <Button 
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto border-2 border-gray-300 text-gray-900 hover:bg-gray-50 px-8 py-6 text-lg font-semibold"
                    >
                      <Phone className="w-5 h-5 mr-2" />
                      0330 229 5040
                    </Button>
                  </a>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Why Choose Us</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-700">5-Star Trustpilot Reviews</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-700">Unlimited Claims</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-700">90 min claims payout</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-700">UK-based claims team</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <img 
                  src={warrantyCarImage} 
                  alt="Buy a Warranty UK - Professional car warranty service" 
                  className="w-full max-w-lg h-auto object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        {/* UK Coverage Section */}
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-4xl mx-auto space-y-4">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                Trusted Warranty Provider Across the UK
              </h2>
              <p className="text-gray-600 text-lg">
                Serving customers nationwide in England, Scotland, Wales & Northern Ireland
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-4">
                {[
                  'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 
                  'Liverpool', 'Newcastle', 'Sheffield', 'Bristol', 'Cardiff',
                  'Edinburgh', 'Belfast'
                ].map((city) => (
                  <span key={city} className="px-4 py-2 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm">
                    {city}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Search Bar & Category Filter Section */}
        <section className="py-12 bg-white border-b border-gray-200">
          <div className="container mx-auto px-4">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Search Bar */}
              <div className="max-w-2xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search articles about car warranties, coverage, claims..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 pr-4 py-6 text-base border-2 border-gray-200 focus:border-primary rounded-lg"
                  />
                </div>
              </div>

              {/* Category Filters */}
              <div className="flex flex-wrap justify-center gap-3">
                {categories.map((category) => (
                  <Button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    variant={selectedCategory === category ? "default" : "outline"}
                    className={`px-6 py-2 rounded-full transition-all ${
                      selectedCategory === category
                        ? 'bg-primary text-white hover:bg-primary/90'
                        : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Featured Article Section */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Featured Article</h2>
                <p className="text-gray-600 text-lg">Our most popular guide this month</p>
              </div>
              
              {featuredPost && (
                <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 border-2 border-gray-200 bg-white">
                  <div className="grid lg:grid-cols-2 gap-0">
                    <div className="relative h-80 lg:h-full overflow-hidden bg-white">
                      <img 
                        src={featuredPost.image} 
                        alt={featuredPost.title}
                        className="w-full h-full object-contain p-4"
                      />
                      <Badge className="absolute top-4 left-4 bg-primary text-white px-4 py-2 text-sm font-semibold shadow-lg">
                        Featured
                      </Badge>
                    </div>
                    
                    <CardContent className="p-8 lg:p-12 flex flex-col justify-center">
                      <div className="space-y-6">
                        <Badge variant="outline" className="border-2 border-primary text-primary font-semibold px-4 py-1">
                          {featuredPost.category}
                        </Badge>
                        
                        <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                          {featuredPost.title}
                        </h3>
                        
                        <p className="text-lg text-gray-600 leading-relaxed">
                          {featuredPost.excerpt}
                        </p>
                        
                        <div className="flex items-center gap-6 text-sm text-gray-500 pt-4 border-t border-gray-200">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span className="font-medium">{featuredPost.author}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{featuredPost.date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{featuredPost.readTime}</span>
                          </div>
                        </div>
                        
                        <Button 
                          className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg font-semibold group"
                        >
                          Read Full Article
                          <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </section>

        {/* CTA Banner Before Recent Posts */}
        <section className="py-16 bg-white border-y border-gray-200">
          <div className="container mx-auto px-4">
            <Card className="max-w-5xl mx-auto bg-gradient-to-r from-primary to-orange-600 border-0">
              <CardContent className="p-8 md:p-12 text-center text-white">
                <h3 className="text-3xl md:text-4xl font-bold mb-4">
                  Ready to Protect Your Vehicle?
                </h3>
                <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
                  Get a free, no-obligation quote in minutes. Trusted by thousands of UK drivers.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Button 
                    size="lg"
                    onClick={navigateToQuoteForm}
                    className="bg-white text-primary hover:bg-gray-50 px-10 py-6 text-lg font-bold"
                  >
                    Get Quote Online
                  </Button>
                  <div className="flex items-center gap-3 text-white">
                    <div className="h-px w-8 bg-white/50" />
                    <span className="text-lg font-medium">or call</span>
                    <div className="h-px w-8 bg-white/50" />
                  </div>
                  <a href="tel:03302295040" className="text-2xl font-bold hover:underline">
                    0330 229 5040
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Main Content Grid with Sidebar */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-7xl mx-auto">
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Main Content - 2/3 width */}
                <div className="lg:col-span-2 space-y-12">
                  {/* Recent Posts Grid */}
                  <div>
                    <div className="mb-8">
                      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Latest Articles</h2>
                      <p className="text-gray-600 text-lg">
                        {selectedCategory === 'All' ? 'All guides and insights' : selectedCategory}
                      </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      {recentPosts.map((post) => (
                        <Card key={post.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 border-2 border-gray-200 hover:border-primary bg-white group">
                          <div className="relative h-48 overflow-hidden bg-white">
                            <img 
                              src={post.image} 
                              alt={post.title}
                              className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                            />
                            <Badge className="absolute top-3 left-3 bg-primary text-white px-3 py-1 text-xs font-semibold shadow-lg">
                              {post.category}
                            </Badge>
                          </div>
                          
                          <CardContent className="p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-primary transition-colors leading-tight line-clamp-2">
                              {post.title}
                            </h3>
                            
                            <p className="text-gray-600 mb-4 text-sm leading-relaxed line-clamp-3">
                              {post.excerpt}
                            </p>
                            
                            <div className="flex items-center gap-4 text-xs text-gray-500 mb-4 pb-4 border-t border-gray-200 pt-4">
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span className="font-medium">{post.author}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{post.readTime}</span>
                              </div>
                            </div>
                            
                            <Button 
                              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 text-sm group/btn"
                            >
                              Read Article
                              <ChevronRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* More Articles - List View */}
                  {olderPosts.length > 0 && (
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-6">More Articles</h3>
                      <div className="space-y-4">
                        {olderPosts.map((post) => (
                          <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 border border-gray-200 hover:border-primary bg-white group">
                            <div className="flex gap-4 p-4">
                              <div className="relative w-32 h-32 flex-shrink-0 overflow-hidden bg-white rounded">
                                <img 
                                  src={post.image} 
                                  alt={post.title}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <Badge className="bg-primary/10 text-primary px-2 py-1 text-xs font-semibold mb-2">
                                  {post.category}
                                </Badge>
                                <h4 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors leading-tight line-clamp-2">
                                  {post.title}
                                </h4>
                                <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 mb-3">
                                  {post.excerpt}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {post.author}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {post.readTime}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="hidden sm:flex items-center">
                                <Button 
                                  variant="ghost"
                                  size="sm"
                                  className="text-primary hover:text-primary hover:bg-primary/5"
                                >
                                  <ChevronRight className="w-5 h-5" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sidebar - 1/3 width */}
                <div className="space-y-8">
                  {/* Quick CTA */}
                  <Card className="bg-gradient-to-br from-primary to-orange-600 border-0 overflow-hidden sticky top-4">
                    <CardContent className="p-6 text-white text-center">
                      <Shield className="w-12 h-12 mx-auto mb-4" />
                      <h3 className="text-xl font-bold mb-2">Get Protected Today</h3>
                      <p className="text-sm opacity-90 mb-4">Free quote in 2 minutes</p>
                      <Button 
                        onClick={navigateToQuoteForm}
                        className="w-full bg-white text-primary hover:bg-gray-50 font-bold"
                      >
                        Get Free Quote
                      </Button>
                      <div className="mt-4 pt-4 border-t border-white/20">
                        <a href="tel:03302295040" className="text-lg font-bold hover:underline block">
                          0330 229 5040
                        </a>
                        <p className="text-xs opacity-75 mt-1">Mon-Fri 9am-5pm</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Categories */}
                  <Card className="border-2 border-gray-200">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Browse by Category</h3>
                      <div className="space-y-2">
                        {categories.filter(c => c !== 'All').map((category) => (
                          <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                              selectedCategory === category
                                ? 'bg-primary text-white'
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Popular Posts */}
                  <Card className="border-2 border-gray-200">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Popular Articles</h3>
                      <div className="space-y-4">
                        {blogPosts.slice(0, 3).map((post, index) => (
                          <div key={post.id} className="flex gap-3 group cursor-pointer">
                            <span className="text-2xl font-bold text-gray-300 flex-shrink-0">{index + 1}</span>
                            <div>
                              <h4 className="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors leading-tight mb-1">
                                {post.title}
                              </h4>
                              <p className="text-xs text-gray-500">{post.readTime}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Newsletter */}
                  <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Stay Updated</h3>
                      <p className="text-sm text-gray-600 mb-4">Get the latest warranty tips & guides</p>
                      <Input 
                        type="email" 
                        placeholder="Your email address"
                        className="mb-3"
                      />
                      <Button className="w-full bg-primary hover:bg-primary/90 text-white">
                        Subscribe
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Popular Topics Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Popular Topics</h2>
                <p className="text-gray-600 text-lg">Explore more warranty guides and advice</p>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { title: 'Warranty Guides', count: '12 articles', icon: Shield },
                  { title: 'Buying Guides', count: '8 articles', icon: Check },
                  { title: 'Commercial Coverage', count: '6 articles', icon: Shield },
                  { title: 'Claims Process', count: '10 articles', icon: Check }
                ].map((topic, index) => (
                  <Card key={index} className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group border-2 border-gray-200 hover:border-primary bg-white">
                    <CardContent className="text-center space-y-4">
                      <div className="w-16 h-16 bg-gray-100 group-hover:bg-primary/10 rounded-full flex items-center justify-center mx-auto transition-colors">
                        <topic.icon className="w-8 h-8 text-gray-600 group-hover:text-primary transition-colors" />
                      </div>
                      <h3 className="font-bold text-lg text-gray-900 group-hover:text-primary transition-colors">
                        {topic.title}
                      </h3>
                      <p className="text-sm text-gray-600">{topic.count}</p>
                      <Button 
                        variant="ghost" 
                        className="text-primary hover:text-primary hover:bg-primary/5 font-semibold"
                      >
                        Browse →
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-20 bg-gray-50 border-t border-gray-200">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <Card className="bg-gradient-to-r from-primary to-orange-600 border-0 overflow-hidden">
                <CardContent className="p-12 md:p-16">
                  <div className="grid lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6 text-white">
                      <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                        Get Protected Today
                      </h2>
                      <p className="text-xl opacity-90 leading-relaxed">
                        Join thousands of satisfied UK drivers who trust Buy a Warranty for comprehensive vehicle protection.
                      </p>
                      <div className="space-y-4 pt-4">
                        <div className="flex items-center gap-3">
                          <Check className="w-6 h-6" />
                          <span className="text-lg">5-Star Trustpilot Reviews</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Check className="w-6 h-6" />
                          <span className="text-lg">Unlimited Claims</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Check className="w-6 h-6" />
                          <span className="text-lg">90 min claims payout</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Check className="w-6 h-6" />
                          <span className="text-lg">UK-based claims team</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <Card className="bg-white p-8">
                        <CardContent className="space-y-6">
                          <h3 className="text-2xl font-bold text-gray-900">Get Your Free Quote</h3>
                          <Button 
                            size="lg"
                            onClick={navigateToQuoteForm}
                            className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-lg font-bold"
                          >
                            Start Your Quote Now
                          </Button>
                          <div className="text-center">
                            <p className="text-gray-600 mb-2">Or speak to our team</p>
                            <a href="tel:03302295040" className="text-3xl font-bold text-primary hover:text-primary/90">
                              0330 229 5040
                            </a>
                            <p className="text-sm text-gray-500 mt-2">Mon-Fri 9am-5pm</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Blog;
