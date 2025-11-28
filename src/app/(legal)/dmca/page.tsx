import React from 'react';

export default function DmcaPage() {
  return (
    <div className="container mx-auto max-w-3xl py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">DMCA Copyright Policy</h1>
      <div className="prose dark:prose-invert">
        <p>
          QuizCraft respects the intellectual property rights of others. If you believe that material 
          available on our website infringes on your copyright, please notify our Designated Copyright Agent.
        </p>
        
        <h3 className="text-lg font-semibold mt-4">How to File a Complaint</h3>
        <p>Please send a written notice containing:</p>
        <ul className="list-disc pl-6 mb-4">
          <li>Identification of the copyrighted work.</li>
          <li>Identification of the infringing material (URL or Quiz ID).</li>
          <li>Your contact information (Address, Phone, Email).</li>
          <li>A statement that you have a good faith belief that use of the material is not authorized.</li>
        </ul>
        
        <div className="p-4 border rounded-md bg-muted">
          <p className="font-semibold">Contact Email:</p>
          <p>legal@quizcraft.com</p> {/* Replace with your actual email */}
        </div>
      </div>
    </div>
  );
}