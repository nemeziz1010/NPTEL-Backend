// Version 1: repeated task
// const puppeteer = require('puppeteer');
// const pool = require('../db');

// async function getAssignmentLinks(courseUrl) {
//   const browser = await puppeteer.launch({ headless: false });
//   const page = await browser.newPage();

//   await page.goto(courseUrl);
//   console.log('Please log in manually... You have 60 seconds.');
//   await new Promise(res => setTimeout(res, 60000));
//   await page.waitForSelector('#gcb-nav-left');

//   const courseName = await page.evaluate(() => {
//     const heading = document.querySelector('h1.gcb-product-headers-large');
//     return heading ? heading.innerText.trim() : 'Unknown Course';
//   });

//   const rawAssignmentLinks = await page.evaluate(() => {
//     const anchors = Array.from(document.querySelectorAll('#gcb-nav-left a'));
//     return anchors
//       .filter(a =>
//         a.innerText.trim().startsWith('Quiz: Week') &&
//         a.href.includes('assessment?name=')
//       )
//       .map(a => ({
//         title: a.innerText.trim(),
//         url: a.href
//       }));
//   });

//   const finalLinks = [];

//   for (const assignment of rawAssignmentLinks) {
//     try {
//       const newPage = await browser.newPage();
//       await newPage.goto(assignment.url, { waitUntil: 'networkidle2' });
//       await new Promise(res => setTimeout(res, 2000));
//       const finalUrl = newPage.url();

//       if (finalUrl.includes('/unit?unit=') && finalUrl.includes('&assessment=')) {
//         finalLinks.push({
//           title: assignment.title,
//           url: finalUrl
//         });
//       }

//       await newPage.close();
//     } catch (err) {
//       console.error(`Error on ${assignment.title}:`, err.message);
//     }
//   }

//   //  Extract and Insert Questions
//   for (const link of finalLinks) {
//     try {
//       const qPage = await browser.newPage();
//       await qPage.goto(link.url, { waitUntil: 'networkidle2' });

//       const questions = await qPage.evaluate(() => {
//         const questionBlocks = document.querySelectorAll('.qt-mc-question');
//         return Array.from(questionBlocks).map(block => {
//           const questionText = block.querySelector('.qt-question')?.innerText.trim() || '';
//           const choices = Array.from(block.querySelectorAll('.gcb-mcq-choice label')).map(label => label.innerText.trim());
//           const correctAnswer = block.querySelector('.qt-feedback .faculty-answer label')?.innerText.trim() || 'Not found';
//           return { question: questionText, options: choices, correctAnswer };
//         });
//       });

//       for (const q of questions) {
//         try {
//           await pool.query(
//             `INSERT INTO questions (course_name, assignment_title, question, options, correct_answer)
//              VALUES ($1, $2, $3, $4, $5)
//              ON CONFLICT DO NOTHING;`,
//             [courseName, link.title, q.question, q.options, q.correctAnswer]
//           );
//           console.log(` Inserted question from ${link.title}`);
//         } catch (dbErr) {
//           console.error(`DB Error for question in ${link.title}:`, dbErr.message);
//         }
//       }

//       await qPage.close();
//     } catch (err) {
//       console.error(` Error processing ${link.title}:`, err.message);
//     }
//   }

//   await browser.close();
//   return { courseName, assignmentLinks: finalLinks }; // You can return empty array if not needed
// }

// module.exports = { getAssignmentLinks };


//Version 2 : efficient extracting mcqs while getting final links
const puppeteer = require('puppeteer');


const pool = require('../db');

async function getAssignmentLinks(courseUrl) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(courseUrl);
  console.log('Please log in manually... You have 60 seconds.');
  await new Promise(res => setTimeout(res, 60000));
  await page.waitForSelector('#gcb-nav-left');

  const courseName = await page.evaluate(() => {
    const heading = document.querySelector('h1.gcb-product-headers-large');
    return heading ? heading.innerText.trim() : 'Unknown Course';
  });

    // //  Redundancy Check: Course already present?, IMPLEMENT THIS WHEN COURSE IS OVER
    // const courseExists = await pool.query(
    //     `SELECT 1 FROM questions WHERE course_name = $1 LIMIT 1`,
    //     [courseName]
    // );
    
    // if (courseExists.rows.length > 0) {
    //     console.log(` Course "${courseName}" already exists in database. Skipping scraping.`);
    //     await browser.close();
    //     return { courseName, assignmentLinks: [] };
    // }
  

  const rawAssignmentLinks = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('#gcb-nav-left a'));
    return anchors
      .filter(a =>
        a.innerText.trim().startsWith('Quiz: Week') &&
        a.href.includes('assessment?name=')
      )
      .map(a => ({
        title: a.innerText.trim(),
        url: a.href
      }));
  });

  const finalLinks = [];

  for (const assignment of rawAssignmentLinks) {

    //  Skip this assignment if it already exists in the database to avoid redundancy
    const assignmentExists = await pool.query(
        `SELECT 1 FROM questions WHERE course_name = $1 AND assignment_title = $2 LIMIT 1`,
        [courseName, assignment.title]
      );
    
      if (assignmentExists.rows.length > 0) {
        console.log(` Assignment "${assignment.title}" already exists. Skipping.`);
        continue;
      }


    try {
      const newPage = await browser.newPage();
      await newPage.goto(assignment.url, { waitUntil: 'networkidle2' });
      await new Promise(res => setTimeout(res, 2000));
      const finalUrl = newPage.url();

      if (finalUrl.includes('/unit?unit=') && finalUrl.includes('&assessment=')) {
        finalLinks.push({ title: assignment.title, url: finalUrl });

        //  Extract & Insert Questions Immediately
        const questions = await newPage.evaluate(() => {
          const questionBlocks = document.querySelectorAll('.qt-mc-question');
          return Array.from(questionBlocks).map(block => {
            const questionText = block.querySelector('.qt-question')?.innerText.trim() || '';
            const choices = Array.from(block.querySelectorAll('.gcb-mcq-choice label')).map(label => label.innerText.trim());
            const correctAnswer = block.querySelector('.qt-feedback .faculty-answer label')?.innerText.trim() || 'Not found';
            return { question: questionText, options: choices, correctAnswer };
          });
        });

        for (const q of questions) {
          try {
            await pool.query(
              `INSERT INTO questions (course_name, assignment_title, question, options, correct_answer)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT DO NOTHING;`,
              [courseName, assignment.title, q.question, q.options, q.correctAnswer]
            );
            
          } catch (dbErr) {
            console.error(`DB Error for ${assignment.title}:`, dbErr.message);
          }
        }
        console.log(` Inserted ${questions.length} questions from ${assignment.title}`);

      }

      await newPage.close();
    } catch (err) {
      console.error(` Error processing ${assignment.title}:`, err.message);
    }
  }

  await browser.close();
  return { courseName, assignmentLinks: finalLinks };
}

module.exports = { getAssignmentLinks };
