import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ScrollToTop = () => {
  const location = useLocation();
  const { pathname, search } = location;
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect /home to / (broken page fix)
    if (pathname === '/home' || pathname === '/home/') {
      navigate('/' + search, { replace: true });
      return;
    }
    
    // Redirect /contact to /contact-us/ (broken page fix)
    if (pathname === '/contact' || pathname === '/contact/') {
      navigate('/contact-us/' + search, { replace: true });
      return;
    }
    
    // Redirect broken portfolio page to homepage
    if (pathname === '/portfolio/car-front-side' || pathname === '/portfolio/car-front-side/') {
      navigate('/' + search, { replace: true });
      return;
    }
    
    // Redirect old EV warranty URL to new URL
    if (pathname === '/best-warranty-on-ev-cars-uk-warranties' || pathname === '/best-warranty-on-ev-cars-uk-warranties/') {
      navigate('/ev-warranty/' + search, { replace: true });
      return;
    }
    
    // Redirect uppercase AUDI-warranty to lowercase
    if (pathname === '/warranty-types/AUDI-warranty' || pathname === '/warranty-types/AUDI-warranty/') {
      navigate('/warranty-types/audi-warranty/' + search, { replace: true });
      return;
    }
    
    // Redirect old van warranty URL to van warranty page
    if (pathname === '/van-warranty-companies-uk-warranties' || pathname === '/van-warranty-companies-uk-warranties/') {
      navigate('/van-warranty/' + search, { replace: true });
      return;
    }
    
    // Redirect URLs without trailing slash to include trailing slash (preserve query params)
    if (pathname !== '/' && !pathname.endsWith('/')) {
      navigate(pathname + '/' + search, { replace: true });
      return;
    }
    
    // Scroll to top when pathname changes
    window.scrollTo(0, 0);
  }, [pathname, search, navigate]);

  return null;
};

export default ScrollToTop;