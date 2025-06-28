// Sample LaTeX content for the main document
export const sampleLatex = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{My Research Paper}
\\author{Research Author}
\\date{\\today}

\\begin{document}

\\maketitle

\\tableofcontents
\\newpage

\\section{Introduction}
This is the introduction to my research paper. We explore the fundamental concepts and provide background information necessary for understanding our methodology.

\\section{Literature Review}
Previous work in this field has established several key principles:
\\begin{itemize}
    \\item First principle of research
    \\item Second important finding
    \\item Third major contribution
\\end{itemize}

\\section{Methodology}
Here I describe the methodology used in this research.

\\subsection{Data Collection}
The data was collected using the following methods:
\\begin{enumerate}
    \\item Surveys distributed to 500+ participants
    \\item In-depth interviews with domain experts  
    \\item Direct observations over 6-month period
\\end{enumerate}

\\subsection{Analysis Framework}
Our analysis follows a structured approach:

\\begin{equation}
\\text{Accuracy} = \\frac{TP + TN}{TP + TN + FP + FN}
\\end{equation}

Where:
\\begin{itemize}
    \\item $TP$ = True Positives
    \\item $TN$ = True Negatives  
    \\item $FP$ = False Positives
    \\item $FN$ = False Negatives
\\end{itemize}

\\section{Results}
The results of our analysis are shown below:

\\begin{equation}
E = mc^2
\\end{equation}

This fundamental equation demonstrates the relationship between energy and mass.

\\begin{table}[h]
\\centering
\\begin{tabular}{|c|c|c|}
\\hline
Method & Accuracy & Time (ms) \\\\
\\hline
Algorithm A & 94.2\\% & 1.2 \\\\
Algorithm B & 96.8\\% & 2.1 \\\\
Algorithm C & 92.1\\% & 0.8 \\\\
\\hline
\\end{tabular}
\\caption{Performance comparison of different algorithms}
\\label{tab:performance}
\\end{table}

\\section{Discussion}
The results indicate significant improvements over baseline methods. Key findings include:

\\begin{itemize}
    \\item 15\\% improvement in accuracy
    \\item 40\\% reduction in processing time
    \\item Better scalability for large datasets
\\end{itemize}

\\section{Conclusion}
In conclusion, this research demonstrates the effectiveness of our proposed approach. Future work will focus on:
\\begin{enumerate}
    \\item Extension to multi-modal data
    \\item Real-time processing capabilities
    \\item Integration with existing systems
\\end{enumerate}

\\section*{Acknowledgments}
We thank the research team and funding agencies for their support.

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}`;

// Sample bibliography content
export const sampleBibliography = `@article{smith2023,
  title={Advanced Methods in Data Analysis},
  author={Smith, John and Doe, Jane},
  journal={Journal of Computer Science},
  volume={45},
  number={3},
  pages={123--145},
  year={2023},
  publisher={Academic Press}
}

@book{johnson2022,
  title={Machine Learning Fundamentals},
  author={Johnson, Alice},
  publisher={Tech Publications},
  year={2022},
  address={New York}
}

@inproceedings{brown2023,
  title={Scalable Algorithms for Big Data},
  author={Brown, Bob and Wilson, Carol},
  booktitle={Proceedings of the International Conference on Data Science},
  pages={78--85},
  year={2023},
  organization={IEEE}
}`;

// Generate sample content for chapter files
export const getSampleChapterContent = (filename) => {
  const chapterName = filename.replace('.tex', '');
  const capitalizedName = chapterName.charAt(0).toUpperCase() + chapterName.slice(1);
  
  return `\\section{${capitalizedName}}

This is the content for the ${chapterName} section.

\\subsection{Overview}
Add your content here...

\\subsection{Details}
More detailed information...

\\subsection{Key Points}
\\begin{itemize}
    \\item Important point one
    \\item Important point two
    \\item Important point three
\\end{itemize}

\\subsection{Mathematical Expressions}
Some mathematical expressions can be included:

\\begin{equation}
f(x) = ax^2 + bx + c
\\end{equation}

Where $a$, $b$, and $c$ are constants.
`;
};

// Download TeX file function
export const downloadTeX = (content, activeFile) => {
  if (!content) {
    alert('No content to download');
    return false;
  }
  
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = activeFile?.name || 'document.tex';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
};

// Download PDF file function
export const downloadPDF = (pdfUrl, project) => {
  if (!pdfUrl) {
    return false;
  }
  
  const a = document.createElement('a');
  a.href = pdfUrl;
  a.download = `${project?.title || 'document'}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
};

// File type detection
export const getFileType = (filename) => {
  const extension = filename.split('.').pop().toLowerCase();
  
  const fileTypes = {
    'tex': 'latex',
    'bib': 'bibtex',
    'cls': 'latex',
    'sty': 'latex',
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'pdf': 'pdf',
    'eps': 'image'
  };
  
  return fileTypes[extension] || 'text';
};

// Get file icon based on file type
export const getFileIcon = (filename) => {
  const fileType = getFileType(filename);
  
  // This would return appropriate icon classes or components
  // For now, returning a simple mapping
  const iconMap = {
    'latex': 'document-text',
    'bibtex': 'document-text',
    'image': 'photo',
    'pdf': 'document',
    'text': 'document-text'
  };
  
  return iconMap[fileType] || 'document-text';
};