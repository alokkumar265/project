import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Github, Linkedin, Mail } from 'lucide-react';

const developers = [
  {
    name: "Alok",
    role: "Lead Developer",
    image: "/developers/alok.jpg",
    bio: "*Alok* is a driven Data Science student at Haldia Institute of Technology with diverse real-world experience across data engineering, machine learning, and cloud computing. At *Cognizant*, he works as a Database Intern optimizing SQL/MySQL/Snowflake queries and building cloud-native solutions using AWS. Previously at *Databits Technologia*, he deployed ML models on AWS infrastructure using PySpark and EMR. As a* top-rated Chegg Subject Matter Expert*, he's delivered 5000+ high-quality solutions in Data Structures, Algorithms, and Analytics. Alok's technical stack spans C++, Python, SQL, AWS, TensorFlow, and Power BI, backed by multiple certifications and project work in predictive healthcare and full-stack web apps.",
    github: "https://github.com/aloksingh1818",
    linkedin: "https://www.linkedin.com/in/alok-kumar-singh-119481218/",
    email: "alok85820018@gmail.com"
  },
  {
    name: "Sharique",
    role: "UI/UX Designer",
    image: "/developers/sharique.jpg",
    bio: "Creative designer focused on creating beautiful and intuitive user interfaces. Specializes in responsive design and user experience.",
    github: "https://github.com/yourusername",
    linkedin: "https://linkedin.com/in/yourusername",
    email: "sharique@example.com"
  },
  {
    name: "Arif",
    role: "Backend Developer",
    image: "/developers/arif.jpg",
    bio: "Backend specialist with experience in database design and API development. Ensures robust and scalable solutions.",
    github: "https://github.com/yourusername",
    linkedin: "https://linkedin.com/in/yourusername",
    email: "arif@example.com"
  }
];

const Developers = () => {
  const formatBio = (bio: string) => {
    return bio.split('*').map((part, index) => 
      index % 2 === 1 ? <strong key={index}>{part}</strong> : part
    );
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl bg-gradient-to-b from-green-50 to-white min-h-screen">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-green-800 mb-2">Meet the Developers</h1>
        <p className="text-green-600">The team behind Foliage Pixel Probe</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {developers.map((dev) => (
          <Card key={dev.name} className="overflow-hidden border-2 border-green-200 shadow-lg hover:shadow-xl transition-shadow">
            <div className="aspect-w-1 aspect-h-1 relative w-full h-64">
              <img
                src={dev.image}
                alt={dev.name}
                className="object-cover w-full h-full"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
            </div>
            <CardHeader className="bg-green-100">
              <CardTitle className="text-green-700 text-xl font-bold">{dev.name}</CardTitle>
              <p className="text-green-600 text-sm">{dev.role}</p>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                {formatBio(dev.bio)}
              </p>
              <div className="flex justify-center space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-700 border-green-300 hover:bg-green-50"
                  onClick={() => window.open(dev.github, '_blank')}
                >
                  <Github className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-700 border-green-300 hover:bg-green-50"
                  onClick={() => window.open(dev.linkedin, '_blank')}
                >
                  <Linkedin className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-700 border-green-300 hover:bg-green-50"
                  onClick={() => window.location.href = `mailto:${dev.email}`}
                >
                  <Mail className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-gray-600 text-sm">
          Together, we're making plant analysis more accessible and accurate.
        </p>
      </div>
    </div>
  );
};

export default Developers; 